#!/usr/bin/env node
// ----------------------------------------------------------------------
// OmniBaby — ajoute le chrono de tétée au plugin @capacitor/local-notifications
// (CI GitHub Actions, après « npm install », avant la compilation Android).
//
//  1. copie android-plugin/OmniBabyChrono.java dans les sources du plugin ;
//  2. insère dans LocalNotificationManager.buildNotification() l'appel à
//     OmniBabyChrono.apply(...) quand la notification porte extra.chronoLayout.
//
// Si le plugin a changé (ancre introuvable) : avertissement, rien n'est
// modifié → la notification reste standard, sans chrono, et le build passe.
// ----------------------------------------------------------------------
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PKG = join(ROOT, 'node_modules/@capacitor/local-notifications');
const DIR = join(PKG, 'android/src/main/java/com/capacitorjs/plugins/localnotifications');
const MANAGER = join(DIR, 'LocalNotificationManager.java');
const MARK = '// OMNIBABY_CHRONO';
const ANCHOR = 'createActionIntents(localNotification, mBuilder);';

function warn(msg) {
  console.log(`::warning::Chrono de notification non installé : ${msg}`);
  process.exit(0);
}

if (!existsSync(MANAGER)) warn('plugin @capacitor/local-notifications introuvable (npm install ?)');
const version = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')).version;
let src = readFileSync(MANAGER, 'utf8');

if (src.includes(MARK)) {
  console.log(`✓ Chrono déjà installé (plugin ${version})`);
} else {
  const count = src.split(ANCHOR).length - 1;
  if (count !== 1) warn(`ancre trouvée ${count} fois dans LocalNotificationManager.java (plugin ${version})`);
  const snippet = `${MARK} — chrono de tétée (android-plugin/OmniBabyChrono.java)
        try {
            JSObject obExtra = localNotification.getExtra();
            if (obExtra != null && obExtra.has("chronoLayout")) {
                OmniBabyChrono.apply(context, mBuilder, obExtra);
            }
        } catch (Exception obError) {
            Logger.error(Logger.tags("LN"), "OmniBaby chrono", obError);
        }
        `;
  src = src.replace(ANCHOR, snippet + ANCHOR);
  copyFileSync(join(ROOT, 'android-plugin/OmniBabyChrono.java'), join(DIR, 'OmniBabyChrono.java'));
  writeFileSync(MANAGER, src);
  console.log(`✓ Chrono de tétée installé dans le plugin local-notifications ${version}`);
}
