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

/**
 * OmniBaby — bouton « Changer de côté » de la notification « Tétée en cours »,
 * traité sans ouvrir l'appli (donc sans déverrouiller le téléphone).
 * Relit l'état rangé dans la notification, bascule de côté et la réaffiche
 * avec les chronos relancés. L'appli reprend cet état à son ouverture.
 */
public class OmniBabyChronoReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
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
}
