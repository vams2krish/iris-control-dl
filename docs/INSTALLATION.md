# Install, set up and run Iris Control

Choose the platform first:

| Device | What to install | Scope |
|---|---|---|
| Windows 10/11 x64 | Iris Control portable Windows ZIP | Primary monitor across ordinary applications and browsers |
| Android 9+ | Iris Control APK | Other Android apps via an explicitly enabled Accessibility Service |
| Supported iPhone | Apple's built-in Eye Tracking | iOS system accessibility; the repository has no installable iPhone app |
| Ordinary web browser | Nothing beyond the local web UI | Practice area inside that page only |

Download development binaries from [GitHub Releases](https://github.com/vams2krish/iris-control-dl/releases). These are experimental builds, not store releases. The Windows steps are in [desktop/README.md](../desktop/README.md).

## Android: install on the phone

1. Download the Android `.apk` release asset to your phone. **An APK is Android-only; it cannot be installed on an iPhone.**
2. Open the download in your browser or Files app. Android may ask you whether that specific app may install unknown apps. Grant that installation permission only if you trust this development build; no root is needed.
3. Tap **Install**, then open **Iris Control**. If Android rejects an update due to an incompatible signing certificate, use a build signed with the same key as the installed copy. Uninstalling the old app removes its calibration and settings; do not uninstall just to troubleshoot without preserving what you need.
4. Tap **1. Start camera**. Allow **Camera** and **Notifications**. Camera permission provides the tracking input; notifications expose the persistent **Stop** control.
5. Place the phone in a stable portrait mount with the front camera near eye level. Use even indoor light, keep both eyes visible, and avoid a bright light reflected in glasses.
6. Confirm the status shows a clear face and a nonzero FPS before calibrating. If the camera fails, close other camera/video-call apps and check Settings → Apps → Iris Control → Permissions → Camera.

## Android: calibrate, enable and use

1. In Iris Control, tap **2. Calibrate gaze · 9 points**.
2. Look at each lavender dot with your eyes, without reaching for it. Each point waits for the gaze to settle, then collects **24 open-eye samples**. It advances automatically. Keep the phone and your posture steady.
3. When all nine points complete, the main screen should show **Calibrated**. If the process waits indefinitely, improve lighting, move your face fully into view, or cancel and retry. A failed/canceled calibration preserves the previous saved profile.
4. Tap **3. Open accessibility settings**. Depending on Android/device wording, open **Downloaded apps**, **Installed apps**, or **Iris Control**. Turn on **Use Iris Control** and read/accept the system disclosure if you want it to send gestures on your behalf.
5. On some sideloaded Android 13+ installations, Android may block this with **Restricted setting**. Google's documented route is Settings → Apps → Iris Control → More/three dots → **Allow restricted settings**, then return to Accessibility. This grants powerful access; choose it only for an app you trust. [Official Android instructions](https://support.google.com/android/answer/12623953?hl=en).
6. Return to Iris Control. If the camera stopped, tap **Start camera** again. Check **Calibrated** and **Accessibility enabled**.
7. Tap **4. Enable gaze actions**. Starting the camera alone intentionally does not enable taps.
8. A cursor and top navigation toolbar should appear. Open **Calculator** and dwell on a large key for approximately one second. A digit should appear once. Look away before selecting the same key again.
9. Dwell on the top toolbar for **Back, Home, Apps/Recents, Alerts, Quick settings, mode switching or Pause**. Toolbar targets consume the tap.
10. In Scroll mode, hold gaze near an edge to repeat swipes. In Typing mode, focus a text field and use dwell taps on the installed keyboard. Use large keyboard keys where possible; swipe typing is not implemented.

### Android: pause, stop and next launch

- **Pause actions:** use Pause on the gaze toolbar or Pause actions in the app. Resume from the app in this version.
- **Stop camera:** use Stop camera in the app or **Stop** in the persistent notification. Turning the screen off also stops tracking.
- After a process restart or camera start, actions begin paused. Open Iris Control, start camera, verify the saved profile, then enable actions again.
- Recalibrate after moving the mount, changing posture, rotating the phone or changing camera distance. Rotation/configuration changes pause actions.
- Accessibility can be turned off in Android settings whenever desired.

### Android: install from a computer (USB alternative)

USB debugging is needed only for developer installation/testing. It is **not** an accessibility permission and is not required for normal APK installation or everyday gaze control.

1. Enable Developer options on the phone by tapping Build number seven times in Settings → About phone (manufacturer wording varies).
2. In Developer options, enable USB debugging. Connect a data-capable USB cable and unlock the phone.
3. Accept the phone's debugging authorization prompt for the computer you trust.
4. With Android Platform Tools installed, run:

```sh
adb devices
adb install -r iris-control-android-0.1.1.apk
adb shell am start -n dev.iris.control/.ui.MainActivity
```

The first command should list the device as `device`, not `unauthorized`. Use the camera, calibration and accessibility steps above after installation. USB debugging does not automatically enable any of them. You may disable USB debugging when developer testing is finished.

## iPhone: built-in Eye Tracking

There is **no Iris Control IPA/TestFlight build** in this repository. The Swift file is an app-local ARKit starter for developers, not a system-wide iPhone controller. Use Apple's system Eye Tracking for iPhone-wide interaction.

1. Check Apple's [current Eye Tracking compatibility and setup guide](https://support.apple.com/guide/iphone/iph66057d0f6/ios) for your iPhone and iOS version. If the setting is absent, verify compatibility before expecting it to appear.
2. Mount the supported iPhone in a stable position with the front camera unobstructed, adequate light, and your face visible.
3. Open **Settings → Accessibility → Eye Tracking** and turn it on.
4. Follow Apple's on-screen calibration dots. Keep your head and phone comfortably steady.
5. Configure the available smoothing, dwell and pointer options in that iOS version. Test by dwelling on a large, harmless control.
6. Use the system's available AssistiveTouch or other accessibility options for additional actions. Their exact menus vary by iOS version; follow Apple's guide rather than the Android instructions.
7. Return to Settings → Accessibility → Eye Tracking to disable it. The Iris web page cannot enable or configure this system setting for you.

For developers wanting to run the custom **in-app-only** ARKit starter on a supported iPhone, see [ios/README.md](../ios/README.md). It requires macOS, Xcode, camera-purpose text, a host app project and Apple signing. It has not been compiled on this Windows machine.

## Web camera chunk error

If you see **“Failed to load chunk /_next/static/chunks/…”**, the open page may refer to a previous build that was replaced while it was open.

1. Stop the camera session and reload the page. If necessary, use Ctrl+Shift+R in a desktop browser.
2. Keep a local web server running. Opening a saved HTML file directly or stopping the server prevents lazy camera files from loading.
3. When building manually, wait for `npm run build` to finish before opening/reloading the static export. Do not replace the export while an active camera session uses it.
4. The repository's preview server sends `Cache-Control: no-store`:

```sh
node desktop/static-server.cjs
```

Open the literal URL it prints. This server provides the **web practice UI only**. For Windows-wide input, run `IrisControl.exe`; the ordinary browser has no desktop bridge.

The app now explains stale camera chunks and presents a **Reload page** recovery action instead of repeatedly trying the same old import.
