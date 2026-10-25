package com.capacitorjs.plugins.localnotifications;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * OmniBaby — état du minuteur de tétée côté Android (copie de celui de
 * src/timer.js), pour changer de côté depuis l'écran de verrouillage sans
 * ouvrir l'appli. Instants en ms (epoch), cumuls en secondes.
 */
final class ObTimer {
    String side = "gauche";
    boolean running = true;
    long startedAt, sideStart, updatedAt;
    double accG, accD;

    static ObTimer parse(String json) throws JSONException {
        JSONObject o = new JSONObject(json);
        ObTimer t = new ObTimer();
        t.side = o.optString("side", "gauche");
        t.running = o.optBoolean("running", true);
        t.startedAt = o.optLong("startedAt", 0);
        t.sideStart = o.optLong("sideStart", 0);
        t.updatedAt = o.optLong("updatedAt", 0);
        t.accG = o.optDouble("accG", 0);
        t.accD = o.optDouble("accD", 0);
        return t;
    }

    String toJson() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("side", side);
        o.put("running", running);
        o.put("startedAt", startedAt);
        o.put("sideStart", sideStart);
        o.put("updatedAt", updatedAt);
        o.put("accG", accG);
        o.put("accD", accD);
        return o.toString();
    }

    boolean droit() {
        return "droit".equals(side);
    }

    /** Même règle que switchSide() dans src/timer.js */
    void switchSide(long now) {
        if (running) {
            double d = Math.max(0, (now - sideStart) / 1000.0);
            if (droit()) accD += d; else accG += d;
        }
        side = droit() ? "gauche" : "droit";
        sideStart = now;
        running = true;
        updatedAt = now;
    }

    private long ref(long now) {
        return running ? sideStart : now; // en pause : valeurs figées
    }

    long totalBase(long now) {
        return ref(now) - Math.round((accG + accD) * 1000);
    }

    long sideBase(long now) {
        return ref(now) - Math.round((droit() ? accD : accG) * 1000);
    }

    String statusText() {
        return running ? "Tétée en cours — côté " + (droit() ? "droit" : "gauche") : "Tétée en pause";
    }

    String sideLabel() {
        return droit() ? "Droit" : "Gauche";
    }

    String sideMark() {
        return running ? "●" : "pause";
    }

    String otherText() {
        return (droit() ? "Gauche " : "Droit ") + chrono(droit() ? accG : accD);
    }

    /** MM:SS, puis H:MM:SS (format des Chronometer Android) */
    static String chrono(double seconds) {
        long s = Math.max(0, (long) Math.floor(seconds));
        long h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
        return h > 0 ? String.format("%d:%02d:%02d", h, m, sec) : String.format("%02d:%02d", m, sec);
    }
}
