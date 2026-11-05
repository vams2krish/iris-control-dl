# Iris Control for Windows

The Windows app uses the same React interface as the web demo, plus a local Electron host and a native C# input helper. Once calibrated and explicitly enabled, the gaze cursor operates **the primary Windows monitor**, including Chrome, Firefox, Edge, File Explorer, and ordinary desktop applications. The target browser does not need an extension or a copy of the Iris webpage.

This is an experimental development build for **Windows 10/11, x64**, with a front-facing webcam. It cannot control the lock screen, UAC secure desktop, or apps running at a higher integrity level. Actual gaze accuracy depends on camera placement and calibration; test harmless targets first.

## Version 0.3: choose an input that works for you

The 0.2.1 user retest still reported jitter/inaccuracy. Increasing dwell tolerance was insufficient. Version 0.3 corrects the Windows/web eye feature calculation, standardizes and robustly fits calibration samples, and requires a separate accuracy check before enabling eye clicks. It also provides a **Head pointer** alternative. Neither mode has demonstrated universal real-world accuracy.

**Head pointer:** start camera → choose Head pointer → click Center head → hold your head still for 30 valid frames → enable actions. Move your head slightly left/right/up/down to steer the mouse; return to your neutral pose to stop, then dwell. The pointer follows the steering position without gaze pinning, and clicks do not accumulate while it moves faster than 8 pixels/second. If your posture changes, pause and center again. This mode deliberately uses head motion, not eye gaze.

The neutral dead zone is adapted to the noise observed during centering. Head mode does not depend on eyelid/blink classification; use dwell and the toolbar for its clicks.

**Eye pointer:** start camera → choose Eye pointer → Calibrate + validate. Look at nine training dots followed by five validation dots (four new locations plus a center repeat). The app reports mean miss, worst miss and within-target jitter. Native eye actions stay disabled unless mean miss ≤5%, worst miss ≤10%, and 90th-percentile jitter ≤3.5% in normalized screen coordinates. These are coarse engineering thresholds, not a medical or precision certification. A failed check directs you to the head pointer.

Old browser eye profiles are rejected because the feature basis changed. Recalibrate. Android 0.1.1 is unchanged by this Windows/web update.

The corrected eye features use the eye-corner coordinate basis, normalize both axes by eye width, and account for the video aspect ratio. Eyelid aperture is used only for blink detection. Per-target medians reduce training outliers; standardization prevents the ridge penalty from suppressing small iris signals. A five-frame median precedes cursor smoothing.

MediaPipe landmarks alone are not a dedicated gaze estimator. Google's [Iris documentation](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/iris.md) explicitly distinguishes iris tracking from inferring a person's point of regard. This app's fitted screen mapping remains experimental.

## Install the portable app

1. Open the repository's [Releases](https://github.com/vams2krish/iris-control-dl/releases) page.
2. Download the Windows ZIP from the latest preview release. Compare its SHA-256 against `SHA256SUMS.txt` if you want to verify the download.
3. Extract the **entire ZIP** to a writable folder, such as Documents. Keep `resources`, the DLLs, and `IrisControl.exe` together; do not launch directly inside the ZIP.
4. Open `IrisControl.exe`. No administrator permission, browser extension, cloud account, or API key is needed. The portable build is unsigned; do not disable Windows protections to run it. You can inspect and build the source instead.
5. Click **Start session**. Read the local-camera prompt and allow it if you want tracking. Windows must also allow desktop apps to access the camera under Settings → Privacy & security → Camera.
6. Sit comfortably with the webcam fixed near the center of the primary monitor. Click **Calibrate full screen** and look at each of the nine dots. Keep the window full screen until all points complete.
7. Click **Enable desktop actions · 3s delay**. The first three seconds give you time to switch to a harmless target application.
8. Keep Iris running and switch to Chrome, Firefox, or another app. Gaze moves the real mouse pointer; hold steady to click. Tracking continues while Iris is unfocused or minimized.
9. Use the gaze toolbar at the top center of the primary monitor. Its targets require at least 1.5 seconds of dwell. They consume the selection rather than clicking the app underneath.

## Controls and stopping

| Control | Behavior |
|---|---|
| Steady gaze | One left click per fixation; look away to rearm |
| Two deliberate blinks | Double click; short natural blinks do nothing |
| Long blink, 850–2200 ms | Hold the left button for 750 ms after reopening |
| Pause / Resume toolbar target | Pause input, or resume after a three-second delay |
| Cursor / Scroll | Normal pointing, or repeated wheel scrolling with gaze in the upper/lower quarter of the monitor |
| Double / Right | Select the next-click mode, then look at the application target and dwell to double/right click there; returns to Cursor afterward |
| Drag / Drop | Select Drag, dwell at the source to hold the left button, then look away and dwell at the destination to release; returns to Cursor afterward |
| Keyboard | Open Windows' On-Screen Keyboard; dwell on keys to type into the focused application |
| Back | Alt+Left in the foreground application |
| Next tab | Ctrl+Tab in the foreground application |
| Apps | Alt+Tab to the previous application |
| **Ctrl+Alt+F8** | Emergency stop, including held-button release; requires explicit Enable in Iris to resume |
| Stop session / close app | Release input and stop tracking |

Face loss, low confidence, stale tracking, display changes, renderer failure, suspend and session lock suppress input. A native watchdog independently releases a held button if it stops receiving fresh heartbeats. Keep a physical keyboard/mouse accessible during evaluation.

Desktop calibration is intentionally **session-only** and separate from saved browser-demo calibration. Restarting the desktop app, reloading its UI, or changing displays requires calibration again. This version supports only the primary monitor; moving the camera or changing posture also calls for recalibration.

## Build from source

Requires Windows x64, Node.js **22.12+**, npm, and the Windows .NET Framework 4.x C# compiler. Internet is needed for dependencies, Electron, and model preparation; the packaged app performs inference locally.

From the repository root:

```powershell
cd web
npm ci
npm run prepare:vision
npm run build
cd ../desktop
npm ci
npm run install:runtime
npm run build:native
npm test
npm start
```

To build a portable distribution:

```powershell
npm run package
```

Output: `desktop/release/package/IrisControl-0.3.0-win32-x64/IrisControl.exe`. The package script copies the official Electron distribution and the app into its documented `resources/app` layout. It does not install a service or set up autostart. Electron 45 requires the explicit `install:runtime` step. Close other Iris copies before opening another portable build; the native emergency shortcut must be registered by only one running controller.

The portable app writes disposable Chromium state and startup diagnostics to `iris-runtime/` next to its EXE. Keep the extracted folder writable. Override `IRIS_RUNTIME_DIR` if a different writable location is needed. No camera frames or gaze samples are logged.

## Architecture and boundaries

```text
Local camera → MediaPipe in isolated Electron renderer
             → full-screen calibrated gaze + eye state
             → narrow preload IPC (no raw Node or shell access)
             → validated desktop gesture state machine
             → private stdin pipe to IrisInput.exe
             → Windows mouse/SendInput + click-through overlay
```

The React renderer has Node disabled, context isolation and sandboxing enabled. Only the bundled local UI can send desktop frames. IPC is main-frame/sender checked, bounded, sequenced and freshness checked. The helper has no network port and exposes fixed input commands, not arbitrary commands or text execution. The loopback web server serves static assets only and rejects unexpected Host headers. It uses `Cache-Control: no-store` to avoid stale HTML referencing replaced Next.js chunks.

The helper uses standard Windows input APIs; this is not browser DOM automation or remote desktop. Web content in Chrome/Firefox does not receive access to the native bridge.

## Validation

### Fixation stability in 0.2.1

The first Windows trial confirmed cursor movement, but the user found dwell locking difficult. The controller now settles for 250 ms, pins the pointer/ring to the fixation center, tolerates brief excursions, and requires 160 ms of sustained movement to restart dwell. The **Fixation stability** slider controls tolerance (default 4% of monitor width, range 1.5–8%). A larger tolerance helps shaky tracking but makes nearby targets harder to distinguish. These state-machine changes pass regression tests; their real webcam usability needs retesting.

The helper compiles and its dry-run integration test exercises input gating without sending real input. State-machine tests cover arming delay, dwell rearming, invalid/stale frames, face loss, toolbar consumption, blink handling and emergency pause. The packaged app was launched on Windows and its React UI/native bridge were inspected. A full webcam-driven cross-application task study remains outstanding; do not equate dry-run tests with demonstrated accuracy in every application.

See [mobile setup](../docs/INSTALLATION.md) for Android and iPhone. See [Microsoft SendInput](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-sendinput) and [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/) for API and isolation details.
