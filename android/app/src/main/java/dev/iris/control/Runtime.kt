package dev.iris.control

import android.content.Context
import dev.iris.control.calibration.Profile
import dev.iris.control.gestures.*
import dev.iris.control.perception.Observation
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONArray
import org.json.JSONObject

data class TrackingState(val running: Boolean = false, val observation: Observation? = null,
    val point: Point = Point(.5,.5), val progress: Double = 0.0, val status: String = "Ready", val fps: Double = 0.0)
object Runtime {
    val state = MutableStateFlow(TrackingState())
    val accessibility = MutableStateFlow(false)
    val armed = MutableStateFlow(false)
    val mode = MutableStateFlow(Mode.CURSOR)
    @Volatile var calibrating = false
    @Volatile var profile: Profile? = null
    @Volatile var config = GestureConfig()
    @Volatile var frameInterval = 40L
    fun load(context: Context) {
        val prefs = context.getSharedPreferences("iris", Context.MODE_PRIVATE)
        prefs.getString("profile", null)?.let { raw -> runCatching {
            val o = JSONObject(raw)
            fun axis(key: String) = o.getJSONArray(key).let { a -> DoubleArray(a.length()) { a.getDouble(it) } }
            val x = axis("x"); val y = axis("y")
            if (x.size == 5 && y.size == 5 && x.all(Double::isFinite) && y.all(Double::isFinite)) profile = Profile(x,y)
        } }
        runCatching {
            val raw = prefs.getString("gestures", null) ?: context.assets.open("gestures.json").bufferedReader().use { it.readText() }
            val o = JSONObject(raw)
            config = GestureConfig(dwellMs = o.getLong("dwellMs").coerceIn(500,3000),
                dwell = Action.valueOf(o.getString("dwell")), doubleBlink = Action.valueOf(o.getString("doubleBlink")), longBlink = Action.valueOf(o.getString("longBlink")))
        }
    }
    fun saveProfile(context: Context, value: Profile) {
        profile = value
        context.getSharedPreferences("iris", Context.MODE_PRIVATE).edit().putString("profile",
            JSONObject().put("x", JSONArray(value.x.toList())).put("y", JSONArray(value.y.toList())).toString()).apply()
    }
    fun saveConfig(context: Context) {
        context.getSharedPreferences("iris", Context.MODE_PRIVATE).edit().putString("gestures",
            JSONObject().put("dwellMs",config.dwellMs).put("dwell",config.dwell.name).put("doubleBlink",config.doubleBlink.name).put("longBlink",config.longBlink.name).toString()).apply()
    }
}
