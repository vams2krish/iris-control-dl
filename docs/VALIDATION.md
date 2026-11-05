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

A Pixel 4a (5G), Android 14 / API 34, was connected for a subsequent device test. The following was observed:

- APK installed successfully over ADB and the main activity launched without an AndroidRuntime crash in the inspected logs.
- The user granted Camera and Notifications; the installed package reports both permissions granted.
- Android reports `dev.iris.control/.accessibility.ControlService` enabled and bound.
- The user confirmed face detection, completed calibration and a visible cursor. A saved calibration profile was present; its coefficients were not published.
- After updating to Android 0.1.1, the user confirmed that gaze dwell entered a digit in the separate Calculator app. This is a user-observed cross-app smoke test, not a measured accuracy benchmark.
- Inspection of the original merged APK found network permissions inherited from a dependency, despite their absence in the app's own manifest. Version 0.1.1 explicitly removes `INTERNET` and `ACCESS_NETWORK_STATE`; `aapt dump permissions` confirms they are absent. The update installed successfully and Camera/Notifications permissions remained granted.
- `apksigner verify --verbose` confirms APK Signature Scheme v2 verification. The development APK is debug-signed.

Real keyboard typing, blink precision, sustained tracking, thermal behavior and FPS targets are not benchmarked. iOS remains an uncompiled starter on Windows.

## Windows desktop preview

- Native C# helper compiled with the Windows .NET Framework compiler.
- Desktop test suite: 15 passed, including input-gating dry-run integration, freshness/sequence checks, fixation rearming, startup delay, face loss, emergency pause, blink handling, right-click target selection, drag/drop, static-server Host/cache behavior and three fixation-stability regression cases.
- The dry-run helper never invokes Windows mouse/keyboard injection; these tests verify the control path, not real desktop selection accuracy.
- The portable Windows app packaged and launched, displaying the React UI and the desktop bridge controls while actions remained paused.
- Web strict typecheck, 5 web unit tests and static build pass with desktop integration.
- The web preview recovered from the stale-chunk/error page by serving the current build. The local static server now uses `Cache-Control: no-store`, and the UI provides explicit reload recovery for stale camera chunks.
- The user confirmed Windows cursor movement in the first trial but reported that gaze did not lock easily. This is not recorded as a successful Windows click test. Version 0.2.1 adds fixation pinning, brief-outlier tolerance, movement hysteresis and a configurable lock radius; regression tests pass, while the webcam usability retest remains pending. Primary-monitor input only; secure/elevated Windows surfaces are excluded.

The host system drive was full at first build, causing Gradle cache writes and JVM/Node allocation failures. Project-local caches and temporary paths on the workspace drive, sequential builds, a one-worker Gradle configuration, Serial GC, and a 128 MiB test JVM allowed Android validation to finish. No unrelated user files were removed.

## Windows/web 0.3 response to the second failed usability test

The user reported that 0.2.1 was still too jittery/inaccurate. The earlier fixation-lock change is therefore not recorded as a successful usability fix.

Code inspection found two calibration/feature problems: vertical iris coordinates were normalized by changing eyelid aperture, and ridge regression operated on unstandardized small-amplitude iris signals. The Windows/web implementation now measures both iris axes in an eye-width basis, corrects video aspect ratio, uses per-target medians and standardization, invalidates old feature profiles, and tests five separate validation targets before enabling eye input. The native process independently checks the quality summary and rejects unacceptable calibration.

An explicitly separate head-pointer mode uses nose position relative to a captured neutral pose to steer by velocity. Returning to neutral stops movement; head input has no gaze-position pinning and dwell does not accumulate during steering. This is not described as improved eye tracking.

Verification: 11 web tests and 18 desktop tests pass locally, including eye-coordinate invariance, eyelid-aperture independence, small-signal calibration, rejection of biased validation data, head neutral/steering/loss behavior, native calibration gates and rejection of old-source frames. Web production build passes. Human usability of 0.3 remains pending; Android 0.1.1 and its prior Pixel smoke test are unchanged.
