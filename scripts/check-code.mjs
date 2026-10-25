#!/usr/bin/env node
// ----------------------------------------------------------------------
// Vérification statique avant build (CI GitHub Actions)
//
// Bloque le build sur les erreurs qui faisaient planter l'appli à
// l'exécution alors que « vite build » passait :
//   - variable / fonction non définie (ex. firebaseUser, update)
//   - import d'un fichier ou d'un export inexistant
//   - déclaration en double, erreur de syntaxe
//   - hook React appelé après un « return » conditionnel
// Les imports / variables inutilisés sont seulement signalés.
//
// Usage : node scripts/check-code.mjs   (nécessite le paquet typescript)
// ----------------------------------------------------------------------
import ts from 'typescript';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = listFiles(SRC);
const TESTS = join(ROOT, 'tests');
// Les tests comptent comme « utilisateurs » des exports, sans être vérifiés
let testFiles = [];
try { testFiles = listFiles(TESTS).filter((f) => /\.test\.js$/.test(f)); } catch (e) { /* pas de tests */ }
const program = ts.createProgram([...files, ...testFiles], {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noUnusedLocals: true,
  skipLibCheck: true,
  strict: false,
  types: [],
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
});

// Codes TypeScript considérés comme bloquants
const BLOCKING = new Set([
  2304, // Cannot find name
  2552, // Cannot find name. Did you mean…
  2305, // Module has no exported member
  2614, // Module has no exported member (did you mean default import)
  2613, // Module has no default export
  2451, // Cannot redeclare block-scoped variable
  2300, // Duplicate identifier
  2448, // Block-scoped variable used before its declaration
  2307, // Cannot find module (fichiers locaux uniquement, voir plus bas)
]);
const WARN = new Set([6133, 6192, 6198]); // déclaré mais jamais utilisé

const errors = [];
const warnings = [];

function where(d) {
  if (!d.file) return '';
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
  return `${relative(ROOT, d.file.fileName)}:${line + 1}:${character + 1}`;
}

const diags = [
  ...program.getSyntacticDiagnostics(),
  ...program.getSemanticDiagnostics(),
];
for (const d of diags) {
  if (!d.file || !d.file.fileName.startsWith(SRC)) continue;
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  if (d.code === 2307) {
    const m = msg.match(/'([^']+)'/);
    const spec = m ? m[1] : '';
    // Paquets npm (résolus par Vite) et suffixes Vite (?url) : ignorés
    if (!spec.startsWith('.') || spec.includes('?')) continue;
  }
  if (d.code === 2305 || d.code === 2614 || d.code === 2613) {
    // Exports manquants : uniquement pour nos fichiers (pas les paquets npm)
    if (!/Module '"\.\.?\//.test(msg)) continue;
  }
  if (d.code >= 1000 && d.code < 2000) errors.push(`${where(d)}  TS${d.code} ${msg}`);
  else if (BLOCKING.has(d.code)) errors.push(`${where(d)}  TS${d.code} ${msg}`);
  else if (WARN.has(d.code)) {
    // « import React » inutile avec le JSX automatique : bruit propre à TypeScript 5
    if (/^'React' is declared/.test(msg)) continue;
    warnings.push(`${where(d)}  ${msg}`);
  }
}

// ── Règle des hooks : pas d'appel useXxx() après un return conditionnel ──
function isComponentOrHook(name) {
  return !!name && (/^[A-Z]/.test(name) || /^use[A-Z]/.test(name));
}
function hookCallsIn(node, found) {
  if (ts.isFunctionLike(node) && node.body) return; // fonctions imbriquées : autre portée
  if (ts.isCallExpression(node)) {
    const e = node.expression;
    const name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
    if (/^use[A-Z]/.test(name)) found.push(node);
  }
  ts.forEachChild(node, (c) => hookCallsIn(c, found));
}
function containsReturn(node) {
  let hit = false;
  const visit = (n) => {
    if (hit || (ts.isFunctionLike(n) && n !== node)) return;
    if (ts.isReturnStatement(n)) { hit = true; return; }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return hit;
}
function checkFunction(name, body, sf) {
  if (!isComponentOrHook(name) || !body || !ts.isBlock(body)) return;
  let returned = false;
  for (const stmt of body.statements) {
    if (returned) {
      const found = [];
      hookCallsIn(stmt, found);
      for (const call of found) {
        const { line, character } = sf.getLineAndCharacterOfPosition(call.getStart(sf));
        errors.push(`${relative(ROOT, sf.fileName)}:${line + 1}:${character + 1}  Hook « ${call.expression.getText(sf)} » appelé après un return conditionnel dans ${name} (crash React)`);
      }
    }
    if (ts.isIfStatement(stmt) && containsReturn(stmt)) returned = true;
  }
}
for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.startsWith(SRC)) continue;
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) checkFunction(n.name.text, n.body, sf);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
      && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      checkFunction(n.name.text, n.initializer.body, sf);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// ── Exports jamais importés (code mort, non bloquant) ──
const exported = new Map(); // fichier → Set(noms)
const used = new Map();     // fichier → Set(noms importés ailleurs)
const opts = program.getCompilerOptions();
function resolve(spec, from) {
  const r = ts.resolveModuleName(spec.split('?')[0], from, opts, ts.sys).resolvedModule;
  return r && r.resolvedFileName.startsWith(SRC) ? r.resolvedFileName : null;
}
for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.startsWith(SRC) && !sf.fileName.startsWith(TESTS)) continue;
  const names = new Set();
  for (const st of sf.statements) {
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) || [] : [];
    const isExport = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isExport && !isDefault) {
      if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) names.add(st.name.text);
      if (ts.isVariableStatement(st)) st.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) && names.add(d.name.text));
    }
    if ((ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      const target = resolve(st.moduleSpecifier.text, sf.fileName);
      if (!target) continue;
      if (!used.has(target)) used.set(target, new Set());
      const bucket = used.get(target);
      const clause = ts.isImportDeclaration(st) ? st.importClause?.namedBindings : st.exportClause;
      if (clause && (ts.isNamedImports(clause) || ts.isNamedExports(clause))) {
        clause.elements.forEach((e) => bucket.add((e.propertyName || e.name).text));
      } else if (clause && ts.isNamespaceImport(clause)) bucket.add('*');
    }
  }
  // import('./x.js') dynamiques : const { a, b } = await import('./x.js')
  const visit = (n) => {
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      const target = resolve(n.arguments[0].text, sf.fileName);
      if (target) {
        if (!used.has(target)) used.set(target, new Set());
        let p = n.parent;
        while (p && !ts.isVariableDeclaration(p)) p = p.parent;
        if (p && ts.isObjectBindingPattern(p.name)) p.name.elements.forEach((e) => used.get(target).add((e.propertyName || e.name).getText(sf)));
        else used.get(target).add('*');
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (sf.fileName.startsWith(SRC)) exported.set(sf.fileName, names);
}
for (const [file, names] of exported) {
  const u = used.get(file) || new Set();
  if (u.has('*')) continue;
  for (const n of names) {
    // utilisé dans son propre fichier ? → simple export superflu, toujours signalé
    if (!u.has(n)) warnings.push(`${relative(ROOT, file)}  export « ${n} » jamais importé`);
  }
}

// ── Icônes : chaque nom utilisé doit exister dans icons.jsx ──
// (un nom inconnu n'affiche rien, sans erreur : cas d'un icons.jsx pas à jour)
{
  const iconsFile = join(SRC, 'icons.jsx');
  const defined = new Set();
  const src = readFileSync(iconsFile, 'utf8');
  const block = src.slice(src.indexOf('const PATHS = {'), src.indexOf('\n};', src.indexOf('const PATHS = {')));
  for (const m of block.matchAll(/^ {2}([a-zA-Z]+):/gm)) defined.add(m[1]);
  const patterns = [
    /<Icon\b[^>]*?\bname="([a-zA-Z]+)"/g,
    /\biconName="([a-zA-Z]+)"/g,
    /\bicon="([a-zA-Z]+)"/g,
    /\bicon: '([a-zA-Z]+)'/g,
    /\bsvg: '([a-zA-Z]+)'/g,
  ];
  for (const f of files) {
    if (f === iconsFile) continue;
    const text = readFileSync(f, 'utf8');
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        if (defined.has(m[1])) continue;
        const line = text.slice(0, m.index).split('\n').length;
        errors.push(`${relative(ROOT, f)}:${line}  icône « ${m[1]} » absente de src/icons.jsx (icons.jsx pas à jour ?)`);
      }
    }
  }
}

// ── Fichiers de la version livrée : tous présents et à jour ──
// scripts/release-files.json liste l'empreinte SHA-256 de chaque fichier
// livré. Un fichier oublié lors de l'envoi sur GitHub bloque le build
// avec son nom, au lieu de produire une appli à moitié à jour.
{
  const manifestPath = join(ROOT, 'scripts', 'release-files.json');
  if (!existsSync(manifestPath)) {
    warnings.push('scripts/release-files.json absent : contrôle des fichiers livrés ignoré');
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const stale = [];
    for (const [rel, hash] of Object.entries(manifest.files || {})) {
      const p = join(ROOT, rel);
      if (!existsSync(p)) { stale.push(`${rel}  (absent)`); continue; }
      const h = createHash('sha256').update(readFileSync(p)).digest('hex');
      if (h !== hash) stale.push(`${rel}  (contenu différent de la ${manifest.version})`);
    }
    if (stale.length) {
      errors.push(`${stale.length} fichier(s) pas à jour par rapport à la version ${manifest.version} — renvoie-les depuis la livraison :`);
      for (const x of stale) errors.push('    ' + x);
      errors.push('    (si TOUS les fichiers que tu viens d’envoyer sont listés, c’est scripts/release-files.json qui n’a pas été mis à jour)');
    }
  }
}

if (warnings.length) {
  console.log(`⚠ ${warnings.length} avertissement(s) (non bloquant) :`);
  for (const w of warnings) console.log('  ' + w);
}
if (errors.length) {
  console.error(`\n✗ ${errors.length} erreur(s) bloquante(s) :`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`✓ ${files.length} fichiers vérifiés, aucune erreur bloquante.`);
