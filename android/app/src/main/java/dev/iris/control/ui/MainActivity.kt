package dev.iris.control.ui

import android.Manifest
import android.content.*
import android.content.pm.PackageManager
import android.os.*
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.*
import androidx.core.content.ContextCompat
import dev.iris.control.Runtime
import dev.iris.control.calibration.*
import dev.iris.control.camera.TrackingService
import dev.iris.control.gestures.*
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    private val permission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[Manifest.permission.CAMERA] == true) startTracking()
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState); enableEdgeToEdge(); Runtime.load(this)
        setContent {
            MaterialTheme(colorScheme=darkColorScheme(primary=Color(0xffa5b4fc), background=Color(0xff101321),surface=Color(0xff1b2033))) {
                Surface(Modifier.fillMaxSize()) { App() }
            }
        }
    }
    private fun startTracking() {
        if (ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permission.launch(if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.CAMERA,Manifest.permission.POST_NOTIFICATIONS) else arrayOf(Manifest.permission.CAMERA)); return
        }
        ContextCompat.startForegroundService(this,Intent(this,TrackingService::class.java))
    }
    @Composable private fun App() {
        val state by Runtime.state.collectAsState()
        val armed by Runtime.armed.collectAsState()
        val accessibility by Runtime.accessibility.collectAsState()
        val mode by Runtime.mode.collectAsState()
        var calibration by remember { mutableStateOf(false) }
        var profileReady by remember { mutableStateOf(Runtime.profile != null) }
        var dwell by remember { mutableFloatStateOf(Runtime.config.dwellMs.toFloat()) }
        var gestureConfig by remember { mutableStateOf(Runtime.config) }
        if (calibration) {
            CalibrationScreen { profileReady=Runtime.profile != null; calibration=false }
            return
        }
        Column(Modifier.fillMaxSize().systemBarsPadding().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement=Arrangement.spacedBy(16.dp)) {
            Text("◉  IRIS CONTROL",style=MaterialTheme.typography.labelLarge,color=MaterialTheme.colorScheme.primary)
            Text("A little movement.\nMore independence.",style=MaterialTheme.typography.headlineLarge)
            Text("Your camera. Your device. Your control.",color=Color(0xffabb1c6))
            Card { Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                Text(state.status,style=MaterialTheme.typography.titleMedium)
                Text("${state.fps.toInt()} FPS · ${if (state.observation != null) "Face detected" else "No reliable face"} · ${if (profileReady) "Calibrated" else "Calibration needed"}")
                Text("Frames are processed in memory. No internet permission, uploads, or recording.",style=MaterialTheme.typography.bodySmall)
            } }
            Button(onClick={ if(state.running) stopService(Intent(this@MainActivity,TrackingService::class.java)) else startTracking() },modifier=Modifier.fillMaxWidth()) { Text(if(state.running) "Stop camera" else "1. Start camera") }
            OutlinedButton(onClick={ Runtime.armed.value=false; calibration=true },enabled=state.running,modifier=Modifier.fillMaxWidth()) { Text("2. Calibrate gaze · 9 points") }
            Text("Accessibility permission",style=MaterialTheme.typography.titleMedium)
            Text("Iris can send taps and swipes and open Home, Back, recent apps, notifications and quick settings. Enable it only if you want phone-wide control. It does not read screen content.")
            OutlinedButton(onClick={ startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) },modifier=Modifier.fillMaxWidth()) { Text(if(accessibility) "Accessibility enabled · settings" else "3. Open accessibility settings") }
            Button(onClick={ Runtime.armed.value=!armed },enabled=state.running && profileReady && accessibility,modifier=Modifier.fillMaxWidth()) { Text(if(armed) "Pause actions" else "4. Enable gaze actions") }
            Text("Mode: ${mode.name.lowercase()}",style=MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) { Mode.entries.forEach { option ->
                FilterChip(selected=mode==option,onClick={ Runtime.mode.value=option },label={ Text(option.name.lowercase(),fontSize=11.sp) })
            } }
            Text("Dwell time · ${dwell.toInt()} ms")
            Slider(value=dwell,onValueChange={ dwell=it },valueRange=500f..2500f,onValueChangeFinished={ Runtime.config=Runtime.config.copy(dwellMs=dwell.toLong()); Runtime.saveConfig(this@MainActivity) })
            Text("Performance",style=MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) { listOf("Low" to 100L,"Balanced" to 50L,"Fast" to 40L).forEach { (label, interval) ->
                OutlinedButton(onClick={ Runtime.frameInterval=interval }) { Text(label) }
            } }
            Text("Gesture mappings",style=MaterialTheme.typography.titleMedium)
            listOf("Dwell" to gestureConfig.dwell,"Double blink" to gestureConfig.doubleBlink,"Long blink" to gestureConfig.longBlink).forEach { (name, action) ->
                var expanded by remember { mutableStateOf(false) }
                Box {
                    OutlinedButton(onClick={ expanded=true }) { Text("$name → ${action.name.lowercase()}") }
                    DropdownMenu(expanded=expanded,onDismissRequest={ expanded=false }) { Action.entries.forEach { choice ->
                        DropdownMenuItem(text={ Text(choice.name.lowercase()) },onClick={
                            Runtime.config=when(name) { "Dwell" -> Runtime.config.copy(dwell=choice); "Double blink" -> Runtime.config.copy(doubleBlink=choice); else -> Runtime.config.copy(longBlink=choice) }
                            Runtime.saveConfig(this@MainActivity); gestureConfig=Runtime.config; expanded=false
                        })
                    } }
                }
            }
            Text("Cursor / typing: dwell once to tap; look away to rearm. Scroll: dwell at an edge to repeat swipes. Navigation: dwell on the top toolbar. Pause via toolbar, app, or Stop notification. Resume from this app.",style=MaterialTheme.typography.bodySmall)
            Text("Use a stable phone mount in portrait. Calibration is experimental; verify on harmless targets before using other apps.",style=MaterialTheme.typography.bodySmall,color=Color(0xffc4b5fd))
        }
    }
    @Composable private fun CalibrationScreen(done: () -> Unit) {
        val state by Runtime.state.collectAsState()
        var index by remember { mutableIntStateOf(0) }
        var count by remember { mutableIntStateOf(0) }
        var error by remember { mutableStateOf<String?>(null) }
        val samples = remember { mutableListOf<CalibrationSample>() }
        DisposableEffect(Unit) { Runtime.calibrating=true; Runtime.armed.value=false; onDispose { Runtime.calibrating=false } }
        LaunchedEffect(index) {
            count=0; delay(1000) // allow saccade to settle
            var lastObservation: Any? = null
            while(count < 24) {
                delay(60)
                val current=Runtime.state.value.observation
                if (current != null && current !== lastObservation && !current.closed && current.confidence >= Runtime.config.confidence) {
                    samples.add(CalibrationSample(current.features.copyOf(),Calibration.targets[index])); count++; lastObservation=current
                }
            }
            if(index < 8) index++ else {
                runCatching { Calibration.fit(samples) }.onSuccess { Runtime.saveProfile(this@MainActivity,it); done() }.onFailure { error=it.message }
            }
        }
        BoxWithConstraints(Modifier.fillMaxSize().background(Color(0xff101321))) {
            val target=Calibration.targets[index]
            Text("Look at the dot · ${index+1}/9",Modifier.align(Alignment.TopCenter).padding(16.dp))
            Box(Modifier.offset(x=maxWidth*target.x.toFloat()-16.dp,y=maxHeight*target.y.toFloat()-16.dp).size(32.dp).background(Color(0xffa5b4fc),androidx.compose.foundation.shape.CircleShape))
            Column(Modifier.align(Alignment.BottomCenter).padding(24.dp),horizontalAlignment=Alignment.CenterHorizontally) {
                Text(error ?: if(state.observation==null) "Waiting for a clear face" else "Hold gaze · $count/24")
                TextButton(onClick=done) { Text("Cancel calibration") }
            }
        }
    }
}
