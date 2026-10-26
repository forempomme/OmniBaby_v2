package com.capacitorjs.plugins.localnotifications;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * OmniBaby — sommeil en cours (copie de l'entrée du journal utile à la
 * notification). Instants en ms (epoch).
 */
final class ObSleep {
    Object entryId;
    long startedAt;
    String kind = "sieste";
    String child = "";

    static ObSleep parse(String json) throws JSONException {
        JSONObject o = new JSONObject(json);
        ObSleep s = new ObSleep();
        s.entryId = o.opt("entryId");
        s.startedAt = o.optLong("startedAt", 0);
        s.kind = o.optString("kind", "sieste");
        s.child = o.optString("child", "");
        return s;
    }

    String toJson() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("entryId", entryId);
        o.put("startedAt", startedAt);
        o.put("kind", kind);
        o.put("child", child);
        return o.toString();
    }

    String kindLabel() {
        return "nuit".equals(kind) ? "Nuit" : "Sieste";
    }

    String statusText() {
        return kindLabel() + " en cours" + (child.isEmpty() ? "" : " — " + child);
    }

    static String hm(long ms) {
        java.util.Calendar c = java.util.Calendar.getInstance();
        c.setTimeInMillis(ms);
        return String.format("%02d:%02d", c.get(java.util.Calendar.HOUR_OF_DAY), c.get(java.util.Calendar.MINUTE));
    }

    /** « 1 h 12 », « 45 min » */
    static String duration(long ms) {
        long min = Math.max(1, Math.round(ms / 60000.0));
        if (min < 60) return min + " min";
        long h = min / 60, m = min % 60;
        return m == 0 ? h + " h" : h + " h " + String.format("%02d", m);
    }

    String sleepingText() {
        return "Endormi à " + hm(startedAt);
    }

    String wokeTitle(long wakeAt) {
        return "Réveil noté à " + hm(wakeAt);
    }

    String wokeText(long wakeAt) {
        return kindLabel() + " de " + duration(wakeAt - startedAt) + " · ouvre OmniBaby pour la synchro";
    }
}
