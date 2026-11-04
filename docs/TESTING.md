# Physical-device and usability checklist

Record device/OS version, front-camera resolution, mount distance, lighting, profile age, FPS, action latency, calibration error, false activations and task completion rate for each run. Do not record faces or typed private content by default.

## Calibration and perception

- [ ] Nine dots complete with 24 distinct reliable open-eye observations each.
- [ ] Cancel preserves the previous profile; restart and process death do not arm actions.
- [ ] Evaluate held-out targets at center, corners and near keyboard keys, not just calibration points.
- [ ] Test dim/bright indoor lighting, backlight and exposure transitions.
- [ ] Test different skin tones, facial geometry, eye shapes, glasses, reflections and partial occlusion.
- [ ] Natural blinks never click; deliberate double/long blinks activate once; sustained occlusion does not long press.
- [ ] Face loss hides the cursor and clears pending dwell; reacquisition starts a fresh dwell.
- [ ] Head movement and phone movement do not silently create unsafe selections; recalibrate as needed.

## Android control and lifecycle

- [ ] Test API 28, 33, 34, 35 and 36 physical devices where available.
- [ ] Start camera only from visible activity; test permission denial, permanent denial and revocation.
- [ ] Notification Stop releases camera; manually stop service, kill process, disable accessibility, and reopen.
- [ ] Home / Back / Recents / Notifications / Quick Settings dispatch as expected.
- [ ] Toolbar targets consume the dwell tap rather than tapping the underlying app.
- [ ] Double tap, long press and all four swipe directions complete/cancel without queue buildup.
- [ ] Scroll mode repeats only at edges; center remains inactive.
- [ ] Test apps with custom surfaces, messaging, browser, launcher and system keyboard using harmless text.
- [ ] Test camera contention with another camera app and calls; service fails visibly and releases resources.
- [ ] Test screen off/lock, orientation changes, permission revocation, battery saver and OEM task killing.
- [ ] Test 30-minute sustained tracking: temperature, memory stability, frame latency, battery drain.
- [ ] Severe thermal status reduces the inference budget; stop and restart cleanly.

## Browser

- [ ] Camera denied/unavailable produces a helpful error and retry control.
- [ ] Start/stop while model initialization is pending leaves no camera tracks alive.
- [ ] Tab hiding stops camera and inference; reopening requires explicit start.
- [ ] Model/WASM missing or blocked fails visibly without external fallback.
- [ ] Calibration, dwell settings and removal survive/recover from reload/storage corruption.
- [ ] Practice keyboard, deletion and space work with pointer, keyboard and calibrated gaze.
- [ ] Scroll actions affect only the practice area; navigation targets only show demo feedback.
- [ ] Inspect network traffic: frames never leave the browser; run with network disconnected and local assets.
- [ ] Check 390px mobile, 768px tablet and 1440px desktop, text scaling, reduced motion and keyboard focus.

## Windows desktop

- [ ] Verify primary-monitor calibration at 100%, 125%, 150% and 200% Windows display scaling.
- [ ] Keep camera tracking and input active while Iris is unfocused/minimized and Chrome, Firefox, Edge, Calculator and File Explorer have focus.
- [ ] Confirm no input until explicit enable and the three-second delay expire.
- [ ] Check dwell rearming, double/right click, long press, drag/drop, wheel scroll and gaze toolbar consumption.
- [ ] Open the On-Screen Keyboard and type harmless text in a focused editor.
- [ ] Ctrl+Alt+F8 releases held input; gaze Resume cannot undo an emergency latch.
- [ ] Face loss, camera track end, app close, suspend, lock, renderer stall and display changes release input.
- [ ] Run without administrator privileges; higher-integrity and secure surfaces remain blocked.
- [ ] Test unsigned portable extraction and same-origin asset loading with the network disconnected.

## Release gate

- [ ] Collaborate with intended users and accessibility specialists; define accepted false-action and task-success thresholds.
- [ ] Validate stop/pause recovery can be used by people with the intended mobility constraints.
- [ ] Add instrumented lifecycle and gesture-completion tests; signed release smoke tests.
- [ ] Review relevant distribution policies and dependency/model licenses before public binary release.
