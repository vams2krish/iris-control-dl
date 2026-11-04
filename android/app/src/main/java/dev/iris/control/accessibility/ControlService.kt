package dev.iris.control.accessibility

import android.accessibilityservice.*
import android.content.Context
import android.graphics.*
import android.os.*
import android.view.*
import android.view.accessibility.AccessibilityEvent
import dev.iris.control.Runtime
import dev.iris.control.gestures.*
import dev.iris.control.gestures.Point

class ControlService : AccessibilityService() {
    companion object { var instance: ControlService? = null; private set }
    private var overlay: CursorView? = null
    private var busy = false
    private val handler = Handler(Looper.getMainLooper())
    override fun onServiceConnected() {
        instance = this; Runtime.accessibility.value = true
        overlay = CursorView(this)
        getSystemService(WindowManager::class.java).addView(overlay,WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT).apply {
                gravity = Gravity.TOP or Gravity.START
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                if (Build.VERSION.SDK_INT >= 30) setFitInsetsTypes(0)
            })
    }
    fun updateCursor(point: Point, progress: Double) { overlay?.apply { p=point; dwell=progress; visibility=View.VISIBLE; invalidate() } }
    fun hideCursor() { overlay?.visibility = View.GONE }
    fun execute(action: Action, point: Point) {
        if (!Runtime.armed.value || busy) return
        val view = overlay ?: return
        val x = (point.x*view.width).toFloat().coerceIn(1f,(view.width-1).toFloat())
        val y = (point.y*view.height).toFloat().coerceIn(1f,(view.height-1).toFloat())
        // Gaze-selectable toolbar consumes dwell actions; it never passes taps through.
        if (action == Action.TAP && y in view.barTop..view.barBottom) {
            when ((point.x*7).toInt().coerceIn(0,6)) {
                0 -> performGlobalAction(GLOBAL_ACTION_BACK)
                1 -> performGlobalAction(GLOBAL_ACTION_HOME)
                2 -> performGlobalAction(GLOBAL_ACTION_RECENTS)
                3 -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
                4 -> performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
                5 -> { Runtime.mode.value = Mode.entries[(Runtime.mode.value.ordinal+1)%Mode.entries.size]; view.invalidate() }
                6 -> Runtime.armed.value = false
            }
            return
        }
        val global = when(action) {
            Action.HOME -> GLOBAL_ACTION_HOME; Action.BACK -> GLOBAL_ACTION_BACK; Action.RECENTS -> GLOBAL_ACTION_RECENTS
            Action.NOTIFICATIONS -> GLOBAL_ACTION_NOTIFICATIONS; Action.QUICK_SETTINGS -> GLOBAL_ACTION_QUICK_SETTINGS; else -> null
        }
        if (global != null) { performGlobalAction(global); return }
        if (action == Action.PAUSE) { Runtime.armed.value=false; return }
        val path = Path().apply {
            moveTo(x,y)
            when(action) {
                Action.SWIPE_UP -> { reset(); moveTo(view.width*.5f,view.height*.7f); lineTo(view.width*.5f,view.height*.3f) }
                Action.SWIPE_DOWN -> { reset(); moveTo(view.width*.5f,view.height*.3f); lineTo(view.width*.5f,view.height*.7f) }
                Action.SWIPE_LEFT -> { reset(); moveTo(view.width*.75f,view.height*.5f); lineTo(view.width*.25f,view.height*.5f) }
                Action.SWIPE_RIGHT -> { reset(); moveTo(view.width*.25f,view.height*.5f); lineTo(view.width*.75f,view.height*.5f) }
                else -> Unit
            }
        }
        val duration = when(action) { Action.LONG_PRESS -> 750L; Action.TAP, Action.DOUBLE_TAP -> 65L; else -> 350L }
        val builder = GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(path,0,duration))
        if (action == Action.DOUBLE_TAP) builder.addStroke(GestureDescription.StrokeDescription(path,160,65))
        busy = true
        val accepted = dispatchGesture(builder.build(),object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) { busy=false }
            override fun onCancelled(gestureDescription: GestureDescription?) { busy=false }
        },handler)
        if (!accepted) busy=false
    }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() { Runtime.armed.value=false; hideCursor() }
    override fun onDestroy() {
        Runtime.accessibility.value=false; Runtime.armed.value=false; instance=null
        overlay?.let { getSystemService(WindowManager::class.java).removeView(it) }; overlay=null
        super.onDestroy()
    }
    private class CursorView(context: Context): View(context) {
        var p=Point(.5,.5); var dwell=0.0
        val barTop get() = height*.06f
        val barBottom get() = height*.13f
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
        init { visibility=GONE; importantForAccessibility=IMPORTANT_FOR_ACCESSIBILITY_NO }
        override fun onDraw(canvas: Canvas) {
            paint.style=Paint.Style.FILL; paint.color=Color.argb(230,24,29,48)
            canvas.drawRoundRect(0f,barTop,width.toFloat(),barBottom,18f,18f,paint)
            paint.color=Color.rgb(224,231,255); paint.textSize=11*resources.displayMetrics.scaledDensity; paint.textAlign=Paint.Align.CENTER
            listOf("Back","Home","Apps","Alerts","Quick",Runtime.mode.value.name.take(4),"Pause").forEachIndexed { i,label ->
                canvas.drawText(label,width*(i+.5f)/7, (barTop+barBottom)/2+5,paint)
            }
            paint.color=Color.rgb(165,180,252); paint.style=Paint.Style.STROKE; paint.strokeWidth=4f
            val x=(p.x*width).toFloat(); val y=(p.y*height).toFloat()
            canvas.drawCircle(x,y,20f,paint)
            paint.strokeWidth=7f; canvas.drawArc(x-27,y-27,x+27,y+27,-90f,(360*dwell).toFloat(),false,paint)
            paint.style=Paint.Style.FILL; canvas.drawCircle(x,y,3f,paint)
        }
    }
}
