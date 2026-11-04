package dev.iris.control.camera

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.graphics.Matrix
import android.os.*
import androidx.camera.core.*
import androidx.camera.core.resolutionselector.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import dev.iris.control.Runtime
import dev.iris.control.TrackingState
import dev.iris.control.accessibility.ControlService
import dev.iris.control.gestures.*
import dev.iris.control.perception.FaceTracker
import dev.iris.control.perception.ExposureMeter
import dev.iris.control.perception.DeviceMotionGate
import dev.iris.control.ui.MainActivity
import java.util.concurrent.Executors

/** User-started camera foreground service. Never silently restarts a camera from background. */
class TrackingService : LifecycleService() {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var camera: ProcessCameraProvider? = null
    private var tracker: FaceTracker? = null
    private var exposure: ExposureMeter? = null
    private var motion: DeviceMotionGate? = null
    private val screenOff = object: BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) { if(intent?.action==Intent.ACTION_SCREEN_OFF) stopSelf() }
    }
    private val engine = GestureEngine()
    private var lastFrame = 0L
    private var smoothed: Point? = null
    private var lastGood = 0L
    private var stopping = false
    private var thermal = PowerManager.THERMAL_STATUS_NONE
    private val thermalListener = if (Build.VERSION.SDK_INT >= 29) PowerManager.OnThermalStatusChangedListener { thermal = it } else null
    private val watchdog = object : Runnable {
        override fun run() {
            if (SystemClock.elapsedRealtime() - lastGood > 600) {
                Runtime.state.value = Runtime.state.value.copy(observation=null, progress=0.0, status="Face lost — actions suspended")
                ControlService.instance?.hideCursor()
            }
            if (!stopping) main.postDelayed(this, 300)
        }
    }
    override fun onCreate() {
        super.onCreate(); Runtime.load(this); motion=DeviceMotionGate(this)
        ContextCompat.registerReceiver(this,screenOff,IntentFilter(Intent.ACTION_SCREEN_OFF),ContextCompat.RECEIVER_NOT_EXPORTED)
        if (Build.VERSION.SDK_INT >= 29) thermalListener?.let { getSystemService(PowerManager::class.java).addThermalStatusListener(mainExecutor, it) }
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        if (intent?.action == "STOP") { stopSelf(); return START_NOT_STICKY }
        if (Runtime.state.value.running) return START_NOT_STICKY
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("tracking", "Gaze tracking", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getService(this, 1, Intent(this, javaClass).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE)
        val open = PendingIntent.getActivity(this, 2, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val notification = Notification.Builder(this,"tracking").setSmallIcon(dev.iris.control.R.drawable.ic_iris)
            .setContentTitle("Iris Control · camera active").setContentText("On-device tracking. Tap Stop to release camera.")
            .setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null,"Stop",stop).build()).build()
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(1,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA) else startForeground(1,notification)
            Runtime.armed.value = false
            Runtime.state.value = TrackingState(running=true,status="Starting camera")
            lastGood = SystemClock.elapsedRealtime(); main.post(watchdog)
            val future = ProcessCameraProvider.getInstance(this)
            future.addListener({
                if (stopping) return@addListener
                try {
                    camera = future.get()
                    val analysis = ImageAnalysis.Builder().setResolutionSelector(ResolutionSelector.Builder()
                        .setResolutionStrategy(ResolutionStrategy(android.util.Size(480,360), ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER)).build())
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                    analysis.setAnalyzer(worker) { frame -> analyze(frame) }
                    camera!!.bindToLifecycle(this,CameraSelector.DEFAULT_FRONT_CAMERA,analysis)
                } catch (e: Exception) { fail(e) }
            }, ContextCompat.getMainExecutor(this))
        } catch (e: Exception) { fail(e) }
        return START_NOT_STICKY
    }
    private fun analyze(frame: ImageProxy) {
        try {
            val now = SystemClock.elapsedRealtime()
            val interval = if (thermal >= PowerManager.THERMAL_STATUS_SEVERE) 200L else Runtime.frameInterval
            if (now - lastFrame < interval || stopping) return
            val delta = now - lastFrame; lastFrame = now
            if (tracker == null) tracker = FaceTracker(this)
            if (exposure == null) exposure = ExposureMeter()
            val source = frame.toBitmap()
            val matrix = Matrix().apply { postRotate(frame.imageInfo.rotationDegrees.toFloat()); postScale(-1f,1f) }
            val upright = android.graphics.Bitmap.createBitmap(source,0,0,source.width,source.height,matrix,true)
            val observation = try { if (exposure!!.usable(upright)) tracker!!.detect(upright,now) else null } finally { if (upright !== source) upright.recycle(); source.recycle() }
            if (observation == null || observation.confidence < Runtime.config.confidence || motion?.stable==false) {
                engine.reset(); smoothed = null
                main.post { Runtime.state.value = Runtime.state.value.copy(observation=null,progress=0.0,status="Face lost — actions suspended"); ControlService.instance?.hideCursor() }
                return
            }
            if (now-lastGood > 600) { engine.reset(); smoothed=null }
            lastGood = now
            val mapped = Runtime.profile?.map(observation.features) ?: Point(.5,.5)
            val old = smoothed
            val point = if (old == null) mapped else Point(old.x + .28*(mapped.x-old.x),old.y + .28*(mapped.y-old.y))
            if (!observation.closed) smoothed = point
            engine.config = Runtime.config
            val enabled = Runtime.armed.value && Runtime.profile != null && !Runtime.calibrating && Runtime.accessibility.value
            val action = if (enabled) engine.update(now,point,observation.confidence,observation.closed,Runtime.mode.value) else { engine.reset(); null }
            main.post {
                if (stopping || SystemClock.elapsedRealtime()-now > 600) return@post
                Runtime.state.value = TrackingState(true,observation,point,engine.progress,
                    if (thermal >= PowerManager.THERMAL_STATUS_SEVERE) "Thermal protection · 5 FPS" else if (enabled) "Tracking · ${Runtime.mode.value.name.lowercase()}" else "Preview · actions paused", if (delta > 0) 1000.0/delta else 0.0)
                if (!Runtime.calibrating) ControlService.instance?.updateCursor(point,engine.progress)
                if (action != null && Runtime.armed.value && !Runtime.calibrating) ControlService.instance?.execute(action,point)
            }
        } catch (e: Exception) { main.post { fail(e) } } finally { frame.close() }
    }
    private fun fail(e: Exception) {
        Runtime.state.value = Runtime.state.value.copy(status="Tracking failed: ${e.message}")
        stopSelf()
    }
    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        Runtime.armed.value=false
        ControlService.instance?.hideCursor()
    }
    override fun onDestroy() {
        stopping = true; main.removeCallbacksAndMessages(null); camera?.unbindAll()
        unregisterReceiver(screenOff); motion?.close()
        if (Build.VERSION.SDK_INT >= 29) thermalListener?.let { getSystemService(PowerManager::class.java).removeThermalStatusListener(it) }
        worker.execute { tracker?.close(); exposure?.close() }; worker.shutdown()
        Runtime.armed.value = false
        Runtime.state.value = Runtime.state.value.copy(running=false,observation=null,progress=0.0)
        ControlService.instance?.hideCursor()
        super.onDestroy()
    }
}
