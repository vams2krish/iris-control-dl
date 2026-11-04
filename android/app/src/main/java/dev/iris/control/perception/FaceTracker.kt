package dev.iris.control.perception

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import kotlin.math.*

data class Observation(val features: DoubleArray, val closed: Boolean, val confidence: Double)
class FaceTracker(context: Context) : AutoCloseable {
    private val detector = FaceLandmarker.createFromOptions(context,
        FaceLandmarker.FaceLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder().setModelAssetPath("face_landmarker.task").build())
            .setRunningMode(RunningMode.VIDEO).setNumFaces(1)
            .setMinFaceDetectionConfidence(.6f).setMinTrackingConfidence(.6f).build())
    fun detect(bitmap: Bitmap, timestamp: Long): Observation? {
        val image = BitmapImageBuilder(bitmap).build()
        try {
            val p = detector.detectForVideo(image, timestamp).faceLandmarks().firstOrNull() ?: return null
            if (p.size < 478) return null
            fun d(a: Int, b: Int) = hypot((p[a].x()-p[b].x()).toDouble(), (p[a].y()-p[b].y()).toDouble())
            fun eye(left: Int, right: Int, top: Int, bottom: Int, iris: Int): Pair<Double, Double> {
                val w = (p[right].x() - p[left].x()).toDouble()
                val h = (p[bottom].y() - p[top].y()).toDouble()
                return ((p[iris].x() - p[left].x()) / w.coerceAtLeast(.001)) to
                    ((p[iris].y() - p[top].y()) / h.coerceAtLeast(.001))
            }
            val l = eye(33,133,159,145,468); val r = eye(362,263,386,374,473)
            val ear = (d(159,145)/d(33,133).coerceAtLeast(.001) + d(386,374)/d(362,263).coerceAtLeast(.001))/2
            val width = d(234,454).coerceAtLeast(.001)
            val headX = (p[1].x() - (p[234].x()+p[454].x())/2) / width
            val headY = (p[1].y() - (p[10].y()+p[152].y())/2) / d(10,152).coerceAtLeast(.001)
            val inside = listOf(33,263,10,152).all { p[it].x() in .02f.. .98f && p[it].y() in .02f.. .98f }
            // Quality heuristic, not the model's calibrated probability. Closed eyes retain
            // geometric confidence so the temporal blink detector can observe reopening.
            val confidence = if (!inside || width < .16 || abs(headX) > .25) .35 else .9
            return Observation(doubleArrayOf((l.first+r.first)/2, (l.second+r.second)/2, headX, headY), ear < .17, confidence)
        } finally { image.close() }
    }
    override fun close() = detector.close()
}
