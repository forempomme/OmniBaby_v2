package com.capacitorjs.plugins.localnotifications;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.widget.RemoteViews;
import com.getcapacitor.Logger;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * OmniBaby — boutons « Changer de côté » (tétée) et « Réveil » (sommeil),
 * traités sans ouvrir l'appli (donc sans déverrouiller le téléphone).
 * Relit l'état rangé dans la notification, bascule de côté et la réaffiche
 * avec les chronos relancés. L'appli reprend cet état à son ouverture.
 */
public class OmniBabyChronoReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        if (OmniBabyChrono.ACTION_WAKE.equals(intent.getAction())) {
            wake(context);
            return;
        }
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            for (StatusBarNotification sbn : nm.getActiveNotifications()) {
                if (sbn.getId() != OmniBabyChrono.NOTIF_ID) continue;
                Notification n = sbn.getNotification();
                String json = n.extras.getString(OmniBabyChrono.STATE_KEY);
                if (json == null) return;
                ObTimer t = ObTimer.parse(json);
                long now = System.currentTimeMillis();
                t.switchSide(now);
                RemoteViews[] v = OmniBabyChrono.views(context, t, now);
                if (v == null) return;
                Notification.Builder b = Notification.Builder.recoverBuilder(context, n);
                b.setCustomContentView(v[0]);
                b.setCustomBigContentView(v[1]);
                b.setContentTitle(t.statusText());
                b.setContentText(t.sideLabel() + " en cours · " + t.otherText());
                b.getExtras().putString(OmniBabyChrono.STATE_KEY, t.toJson());
                nm.notify(sbn.getTag(), OmniBabyChrono.NOTIF_ID, b.build());
                return;
            }
        } catch (Exception e) {
            Logger.error(Logger.tags("LN"), "OmniBaby changement de côté", e);
        }
    }

    /**
     * « Réveil » : note l'heure dans omnibaby_wake.json (lu par l'appli :
     * src/sleepNotif.js) et transforme la notification en « Réveil noté ».
     */
    private void wake(Context context) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            for (StatusBarNotification sbn : nm.getActiveNotifications()) {
                if (sbn.getId() != OmniBabyChrono.SLEEP_NOTIF_ID) continue;
                Notification n = sbn.getNotification();
                String json = n.extras.getString(OmniBabyChrono.SLEEP_KEY);
                if (json == null) return; // réveil déjà noté
                ObSleep s = ObSleep.parse(json);
                long now = System.currentTimeMillis();
                appendWake(context, s.entryId, now);
                RemoteViews[] v = OmniBabyChrono.sleepViews(context, s, now, now);
                Notification.Builder b = Notification.Builder.recoverBuilder(context, n);
                if (v != null) {
                    b.setCustomContentView(v[0]);
                    b.setCustomBigContentView(v[1]);
                }
                b.setContentTitle(s.wokeTitle(now));
                b.setContentText(s.wokeText(now));
                b.setActions(); // plus de bouton « Réveil »
                b.setOngoing(false);
                b.setAutoCancel(true);
                b.getExtras().remove(OmniBabyChrono.SLEEP_KEY);
                nm.notify(sbn.getTag(), OmniBabyChrono.SLEEP_NOTIF_ID, b.build());
                return;
            }
        } catch (Exception e) {
            Logger.error(Logger.tags("LN"), "OmniBaby réveil", e);
        }
    }

    private static void appendWake(Context context, Object entryId, long wakeAt) throws Exception {
        File f = new File(context.getFilesDir(), "omnibaby_wake.json");
        JSONArray list = new JSONArray();
        if (f.exists()) {
            try (FileInputStream in = new FileInputStream(f)) {
                byte[] buf = new byte[(int) f.length()];
                int n = in.read(buf);
                if (n > 0) list = new JSONArray(new String(buf, 0, n, StandardCharsets.UTF_8));
            } catch (Exception ignored) { /* fichier abîmé : on repart de zéro */ }
        }
        JSONObject w = new JSONObject();
        w.put("entryId", entryId);
        w.put("wakeAt", wakeAt);
        list.put(w);
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(list.toString().getBytes(StandardCharsets.UTF_8));
        }
    }
}
