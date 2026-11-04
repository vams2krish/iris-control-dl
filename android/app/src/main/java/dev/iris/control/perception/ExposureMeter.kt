package dev.iris.control.perception

import android.graphics.Bitmap
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.Core
import org.opencv.core.Mat
import org.opencv.imgproc.Imgproc

/** Measures exposure without changing the landmark model's expected RGB input. */
class ExposureMeter : AutoCloseable {
    private val rgba: Mat
    private val gray: Mat
    init {
        check(OpenCVLoader.initLocal()) { "OpenCV could not initialize" }
        rgba=Mat(); gray=Mat()
    }
    fun usable(bitmap: Bitmap): Boolean {
        Utils.bitmapToMat(bitmap,rgba)
        Imgproc.cvtColor(rgba,gray,Imgproc.COLOR_RGBA2GRAY)
        val mean=Core.mean(gray).`val`[0]
        return mean in 25.0..240.0
    }
    override fun close() { rgba.release(); gray.release() }
}
