# Official references

Consulted during implementation, November 4, 2026. Pinned dependencies make builds reproducible; check compatibility before upgrading.

- [MediaPipe Face Landmarker Android guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/android): FaceLandmarker task, VIDEO mode and model assets.
- [MediaPipe Face Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js): local WASM files and synchronous video inference.
- [Android AccessibilityService](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService): `dispatchGesture`, `performGlobalAction`, lifecycle callbacks.
- [Create an accessibility service](https://developer.android.com/guide/topics/ui/accessibility/service): explicit gesture capability declaration.
- [Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types): camera service permissions and while-in-use start restrictions.
- [Apple Eye Tracking](https://support.apple.com/guide/iphone/iph66057d0f6/ios): supported platform setup and system interaction.
- [Apple ARFaceAnchor](https://developer.apple.com/documentation/arkit/arfaceanchor): face-relative eye data and tracking.
- [Apple lookAtPoint](https://developer.apple.com/documentation/arkit/arfaceanchor/lookatpoint): estimated face-relative fixation point.

The application does not claim these APIs provide calibrated gaze accuracy or unrestricted system automation. The browser demo cannot operate Android or iOS remotely.
