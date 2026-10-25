package com.capacitorjs.plugins.localnotifications;

import android.content.Context;
import android.os.SystemClock;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;

/**
 * OmniBaby — chrono de tétée dans la notification « Tétée en cours ».
 *
 * Ajouté au plugin @capacitor/local-notifications pendant le build GitHub
 * (scripts/patch-notif-chrono.mjs). Appelé par LocalNotificationManager
 * quand la notification porte extra.chronoLayout.
 *
 * Les chronos sont des vues Android natives (Chronometer) : ils avancent
 * à la seconde même app fermée, sans réveiller l'appli.
 *
 * extra attendu (calculé par src/timer.js) :
 *   chronoRunning  true = en cours, false = en pause (chronos figés)
 *   totalBase      instant (ms epoch) tel que total = maintenant - totalBase
 *   sideBase       idem pour le côté en cours
 *   statusText, sideLabel, sideMark, otherText : textes affichés
 */
public class OmniBabyChrono {

    private static int id(Context c, String name, String type) {
        return c.getResources().getIdentifier(name, type, c.getPackageName());
    }

    /** @return true si la mise en page personnalisée a été appliquée */
    public static boolean apply(Context context, NotificationCompat.Builder builder, JSObject ex) {
        int small = id(context, "omnibaby_chrono", "layout");
        int big = id(context, "omnibaby_chrono_big", "layout");
        if (small == 0 || big == 0) return false; // mises en page absentes : notification standard

        long now = System.currentTimeMillis();
        long elapsedNow = SystemClock.elapsedRealtime();
        boolean running = ex.optBoolean("chronoRunning", true);
        // Chronometer compte depuis une base en temps « elapsedRealtime »
        long totalBase = elapsedNow - (now - ex.optLong("totalBase", now));
        long sideBase = elapsedNow - (now - ex.optLong("sideBase", now));

        RemoteViews[] views = {
            new RemoteViews(context.getPackageName(), small),
            new RemoteViews(context.getPackageName(), big),
        };
        for (RemoteViews rv : views) {
            rv.setChronometer(id(context, "ob_total", "id"), totalBase, null, running);
            rv.setChronometer(id(context, "ob_side", "id"), sideBase, null, running);
            rv.setTextViewText(id(context, "ob_side_label", "id"), ex.optString("sideLabel", ""));
            rv.setTextViewText(id(context, "ob_side_mark", "id"), ex.optString("sideMark", ""));
            rv.setTextViewText(id(context, "ob_other", "id"), ex.optString("otherText", ""));
            int status = id(context, "ob_status", "id");
            if (status != 0) rv.setTextViewText(status, ex.optString("statusText", ""));
        }
        builder.setCustomContentView(views[0]);
        builder.setCustomBigContentView(views[1]);
        builder.setStyle(new NotificationCompat.DecoratedCustomViewStyle());
        builder.setShowWhen(false);
        return true;
    }
}
