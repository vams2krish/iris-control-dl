package dev.iris.control.calibration
import dev.iris.control.gestures.Point
import org.junit.Assert.*
import org.junit.Test
class CalibrationTest {
    @Test fun fitsKnownMapping() {
        val samples=Calibration.targets.map { CalibrationSample(doubleArrayOf(it.x,it.y,0.0,0.0),it) }
        val result=Calibration.fit(samples).map(doubleArrayOf(.4,.6,0.0,0.0))
        assertEquals(.4,result.x,.01); assertEquals(.6,result.y,.01)
    }
    @Test(expected=IllegalArgumentException::class) fun rejectsInsufficientData() { Calibration.fit(emptyList()) }
    @Test(expected=IllegalArgumentException::class) fun rejectsStationaryEyes() { Calibration.fit(Calibration.targets.map { CalibrationSample(doubleArrayOf(.5,.5,0.0,0.0),it) }) }
}
