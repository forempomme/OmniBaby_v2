#!/usr/bin/env node
// ----------------------------------------------------------------------
// OmniBaby — ajoute le chrono de tétée au plugin @capacitor/local-notifications
// (CI GitHub Actions, après « npm install », avant la compilation Android).
//
//  1. copie android-plugin/*.java dans les sources du plugin ;
//  2. insère dans LocalNotificationManager.buildNotification() l'appel à
//     OmniBabyChrono.apply(...) quand la notification porte extra.obState ;
//  3. déclare OmniBabyChronoReceiver (« Changer de côté » sans ouvrir
//     l'appli) dans le manifeste Android du plugin.
//
// Si le plugin a changé (ancre introuvable) : avertissement, rien n'est
// modifié → la notification reste standard, sans chrono, et le build passe.
// ----------------------------------------------------------------------
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PKG = join(ROOT, 'node_modules/@capacitor/local-notifications');
const DIR = join(PKG, 'android/src/main/java/com/capacitorjs/plugins/localnotifications');
const MANAGER = join(DIR, 'LocalNotificationManager.java');
const PLUGIN_MANIFEST = join(PKG, 'android/src/main/AndroidManifest.xml');
const MARK = '// OMNIBABY_CHRONO_V2';
const RECEIVER = '<receiver android:name="com.capacitorjs.plugins.localnotifications.OmniBabyChronoReceiver" android:exported="false" />';
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
  const manifest = readFileSync(PLUGIN_MANIFEST, 'utf8');
  if (!manifest.includes('</application>')) warn('manifeste du plugin inattendu');
  const snippet = `${MARK} — grand chrono + « Changer de côté » natif (android-plugin/)
        try {
            JSObject obExtra = localNotification.getExtra();
            if (obExtra != null && obExtra.has("obState")
                && OmniBabyChrono.apply(context, mBuilder, obExtra)) {
                String obFinishOnly = obExtra.optString("nativeActionTypeId", "");
                if (!obFinishOnly.isEmpty()) localNotification.setActionTypeId(obFinishOnly);
            }
        } catch (Exception obError) {
            Logger.error(Logger.tags("LN"), "OmniBaby chrono", obError);
        }
        `;
  for (const f of readdirSync(join(ROOT, 'android-plugin')).filter((n) => n.endsWith('.java'))) {
    copyFileSync(join(ROOT, 'android-plugin', f), join(DIR, f));
  }
  writeFileSync(MANAGER, src.replace(ANCHOR, snippet + ANCHOR));
  if (!manifest.includes('OmniBabyChronoReceiver')) {
    writeFileSync(PLUGIN_MANIFEST, manifest.replace('</application>', `    ${RECEIVER}\n    </application>`));
  }
  console.log(`✓ Chrono de tétée et « Changer de côté » natif installés (plugin local-notifications ${version})`);
}
