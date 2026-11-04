package dev.iris.control.perception

import android.content.Context
import android.hardware.*
import kotlin.math.*

/** Device motion veto; supplements face-relative features, not a 3D gaze solver. */
class DeviceMotionGate(context: Context) : SensorEventListener, AutoCloseable {
    private val manager=context.getSystemService(SensorManager::class.java)
    @Volatile private var gyro=0.0
    @Volatile private var acceleration=0.0
    val stable get() = gyro < .45 && acceleration < 2.5
    init {
        listOf(Sensor.TYPE_GYROSCOPE,Sensor.TYPE_ACCELEROMETER).forEach { type ->
            manager.getDefaultSensor(type)?.let { manager.registerListener(this,it,SensorManager.SENSOR_DELAY_UI) }
        }
    }
    override fun onSensorChanged(event: SensorEvent) {
        val magnitude=sqrt(event.values.take(3).sumOf { it.toDouble()*it.toDouble() })
        if(event.sensor.type==Sensor.TYPE_GYROSCOPE) gyro=magnitude
        else acceleration=acceleration*.7+abs(magnitude-SensorManager.GRAVITY_EARTH)*.3
    }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    override fun close() { manager.unregisterListener(this) }
}
