package dev.iris.control.calibration

import dev.iris.control.gestures.Point
import kotlin.math.abs

data class CalibrationSample(val features: DoubleArray, val target: Point)
data class Profile(val x: DoubleArray, val y: DoubleArray) {
    fun map(features: DoubleArray): Point {
        val f = doubleArrayOf(1.0, *features)
        return Point(x.zip(f).sumOf { it.first * it.second }.coerceIn(0.0, 1.0), y.zip(f).sumOf { it.first * it.second }.coerceIn(0.0, 1.0))
    }
}
object Calibration {
    val targets = listOf(.15, .5, .85).flatMap { y -> listOf(.15, .5, .85).map { x -> Point(x, y) } }
    /** Ridge regression maps iris ratios + head offsets to normalized display coordinates. */
    fun fit(samples: List<CalibrationSample>): Profile {
        require(samples.size >= 9)
        val n = samples.first().features.size + 1
        require(samples.all { it.features.size == n - 1 && it.features.all(Double::isFinite) })
        require((0..1).all { axis -> samples.maxOf { it.features[axis] } - samples.minOf { it.features[axis] } > .02 }) {
            "Eye movement was too small. Retry calibration with a stable, well-lit view."
        }
        fun solve(axis: (Point) -> Double): DoubleArray {
            val a = Array(n) { DoubleArray(n + 1) }
            samples.forEach { sample ->
                val f = doubleArrayOf(1.0, *sample.features)
                for (i in 0 until n) { for (j in 0 until n) a[i][j] += f[i] * f[j]; a[i][n] += f[i] * axis(sample.target) }
            }
            for (i in 1 until n) a[i][i] += .001
            for (i in 0 until n) {
                val pivot = (i until n).maxBy { abs(a[it][i]) }
                val temp = a[i]; a[i] = a[pivot]; a[pivot] = temp
                require(abs(a[i][i]) > 1e-10) { "Calibration is degenerate. Retry in better lighting." }
                val divisor = a[i][i]; for (j in i..n) a[i][j] /= divisor
                for (k in 0 until n) if (k != i) { val scale = a[k][i]; for (j in i..n) a[k][j] -= scale * a[i][j] }
            }
            return DoubleArray(n) { a[it][n] }
        }
        return Profile(solve { it.x }, solve { it.y })
    }
}
