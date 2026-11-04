package dev.iris.control.gestures

import kotlin.math.hypot

enum class Action { TAP, DOUBLE_TAP, LONG_PRESS, SWIPE_UP, SWIPE_DOWN, SWIPE_LEFT, SWIPE_RIGHT, HOME, BACK, RECENTS, NOTIFICATIONS, QUICK_SETTINGS, PAUSE }
enum class Mode { CURSOR, SCROLL, TYPING, NAVIGATION }
data class Point(val x: Double, val y: Double)
data class GestureConfig(
    val dwellMs: Long = 1000, val radius: Double = .045, val confidence: Double = .65,
    val blinkMinMs: Long = 180, val blinkMaxMs: Long = 450, val doubleWindowMs: Long = 500,
    val longBlinkMs: Long = 850, val cooldownMs: Long = 900,
    val dwell: Action = Action.TAP, val doubleBlink: Action = Action.DOUBLE_TAP,
    val longBlink: Action = Action.LONG_PRESS
)

/** Monotonic milliseconds only. Natural short blinks never activate a click. */
class GestureEngine(var config: GestureConfig = GestureConfig()) {
    private var anchor: Point? = null
    private var dwellStart = 0L
    private var closedAt: Long? = null
    private var firstBlink: Long? = null
    private var lastAction = -10000L
    private var armed = true
    var progress = 0.0; private set
    fun reset() { anchor = null; closedAt = null; firstBlink = null; progress = 0.0; armed = true }
    fun update(now: Long, point: Point, confidence: Double, closed: Boolean, mode: Mode): Action? {
        if (confidence < config.confidence || !point.x.isFinite() || !point.y.isFinite()) { reset(); return null }
        if (closed) { if (closedAt == null) closedAt = now; anchor = null; progress = 0.0; return null }
        val duration = closedAt?.let { now - it }; closedAt = null
        if (duration != null) {
            if (duration >= config.longBlinkMs && duration < 2200) { firstBlink = null; return emit(now, config.longBlink) }
            if (duration in config.blinkMinMs..config.blinkMaxMs) {
                val previous = firstBlink
                if (previous != null && now - previous <= config.doubleWindowMs + duration) { firstBlink = null; return emit(now, config.doubleBlink) }
                firstBlink = now
            } else firstBlink = null
        }
        if (now - (firstBlink ?: now) > config.doubleWindowMs) firstBlink = null
        val old = anchor
        if (old == null || hypot(old.x - point.x, old.y - point.y) > config.radius) {
            anchor = point; dwellStart = now; armed = true; progress = 0.0; return null
        }
        if (now - lastAction < config.cooldownMs) { dwellStart = now; return null }
        progress = ((now - dwellStart).toDouble() / config.dwellMs).coerceIn(0.0, 1.0)
        if (progress < 1 || !armed) return null
        if (mode == Mode.SCROLL) {
            val action = when { point.y < .22 -> Action.SWIPE_DOWN; point.y > .78 -> Action.SWIPE_UP; point.x < .18 -> Action.SWIPE_RIGHT; point.x > .82 -> Action.SWIPE_LEFT; else -> null }
            dwellStart = now
            return action?.let { emit(now, it) }
        }
        // One action per fixation. Looking away rearms; typing uses the same rule.
        armed = false
        return emit(now, config.dwell)
    }
    private fun emit(now: Long, action: Action): Action? {
        if (now - lastAction < config.cooldownMs) return null
        lastAction = now; progress = 0.0; return action
    }
}
