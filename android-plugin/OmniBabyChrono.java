package com.capacitorjs.plugins.localnotifications;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;

/**
 * OmniBaby — notification « Tétée en cours » avec grand chrono.
 *
 * Ajouté au plugin @capacitor/local-notifications pendant le build GitHub
 * (scripts/patch-notif-chrono.mjs). Appelé par LocalNotificationManager
 * quand la notification porte extra.obState (état du minuteur, JSON).
 *
 *  - Les chronos sont des vues Android natives (Chronometer) : ils avancent
 *    à la seconde même app fermée, sans réveiller l'appli.
 *  - « Changer de côté » est traité par OmniBabyChronoReceiver, sans ouvrir
 *    l'appli → utilisable sur l'écran de verrouillage. L'état à jour est
 *    rangé dans les extras de la notification (clé omnibaby_state) ; l'appli
 *    le relit à son ouverture.
 */
public class OmniBabyChrono {

    static final int NOTIF_ID = 424242;
    static final String STATE_KEY = "omnibaby_state";
    static final String ACTION_SWITCH = "com.omnibaby.TETEE_SWITCH";

    private static int id(Context c, String name, String type) {
        return c.getResources().getIdentifier(name, type, c.getPackageName());
    }

    /** Vues réduite [0] et dépliée [1], ou null si les mises en page manquent */
    static RemoteViews[] views(Context context, ObTimer t, long now) {
        int small = id(context, "omnibaby_chrono", "layout");
        int big = id(context, "omnibaby_chrono_big", "layout");
        if (small == 0 || big == 0) return null;
        // Chronometer compte depuis une base en temps « elapsedRealtime »
        long elapsedNow = SystemClock.elapsedRealtime();
        long totalBase = elapsedNow - (now - t.totalBase(now));
        long sideBase = elapsedNow - (now - t.sideBase(now));
        RemoteViews[] views = {
            new RemoteViews(context.getPackageName(), small),
            new RemoteViews(context.getPackageName(), big),
        };
        for (RemoteViews rv : views) {
            rv.setChronometer(id(context, "ob_total", "id"), totalBase, null, t.running);
            rv.setChronometer(id(context, "ob_side", "id"), sideBase, null, t.running);
            rv.setTextViewText(id(context, "ob_side_label", "id"), t.sideLabel());
            rv.setTextViewText(id(context, "ob_side_mark", "id"), t.sideMark());
            rv.setTextViewText(id(context, "ob_other", "id"), t.otherText());
            int status = id(context, "ob_status", "id");
            if (status != 0) rv.setTextViewText(status, t.statusText());
        }
        return views;
    }

    static PendingIntent switchIntent(Context context) {
        Intent intent = new Intent(context, OmniBabyChronoReceiver.class);
        intent.setAction(ACTION_SWITCH);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, NOTIF_ID + 1, intent, flags);
    }

    /**
     * Applique le grand chrono (si les mises en page sont présentes).
     * @return true si le bouton « Changer de côté » natif a été ajouté :
     * le plugin ne doit alors ajouter que « Terminer ».
     */
    public static boolean apply(Context context, NotificationCompat.Builder builder, JSObject ex) throws Exception {
        String json = ex.optString("obState", "");
        if (json.isEmpty()) return false;
        ObTimer t = ObTimer.parse(json);
        long now = System.currentTimeMillis();
        RemoteViews[] v = views(context, t, now);
        if (v == null) return false; // mises en page absentes : notification standard
        builder.setCustomContentView(v[0]);
        builder.setCustomBigContentView(v[1]);
        builder.setStyle(new NotificationCompat.DecoratedCustomViewStyle());
        builder.setShowWhen(false);
        builder.getExtras().putString(STATE_KEY, t.toJson());
        // Android < 7 : pas de reconstruction de notification possible →
        // « Changer de côté » reste celui de l'appli (ouvre l'appli)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false;
        builder.addAction(R.drawable.ic_transparent, "Changer de côté", switchIntent(context));
        return true;
    }
}
