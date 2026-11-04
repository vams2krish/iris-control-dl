# Validation record

Initial implementation: November 4, 2026.

## Completed

- Web production static export: passed (Next.js 16.4.5).
- TypeScript strict typecheck: passed.
- Web unit tests: 5 passed (known calibration mapping, invalid samples, stored profile validation, missing iris rejection, stationary-eye rejection).
- Browser visual review: desktop workspace renders with indigo/slate styling; real screenshot embedded in README.
- Browser interaction: practice keyboard selected `IRIS`; gesture settings and Android setup navigation verified; dwell changed to 1.6 seconds and persisted across reload.
- Responsive review: 1440px desktop and 390px mobile layouts checked visually; normal viewport restored afterward.
- Android final debug assembly: passed with Gradle 8.13, AGP 8.12.2, Kotlin 2.1.21, JDK 17 and Android SDK 36.
- Android JVM unit tests: 8 passed, 0 failures, 0 errors (3 calibration tests, 5 gesture tests).
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`; approximately 210 MiB because this debug build includes native libraries for multiple ABIs. It is ignored by Git; CI uploads the built APK as an artifact.

## Not established by these checks

No Android physical device was connected (`adb devices` returned an empty list). Camera gaze accuracy, calibrated physical taps, real keyboard typing, blink precision, thermal behavior and FPS targets are not verified. Browser camera access was not enabled against the user's real camera during UI checks. iOS code is an uncompiled starter on Windows.

The host system drive was full at first build, causing Gradle cache writes and JVM/Node allocation failures. Project-local caches and temporary paths on the workspace drive, sequential builds, a one-worker Gradle configuration, Serial GC, and a 128 MiB test JVM allowed Android validation to finish. No unrelated user files were removed.
