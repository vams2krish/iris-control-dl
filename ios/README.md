# iOS path

For phone-wide control on supported iPhones, use Settings → Accessibility → Eye Tracking. Configure dwell and accessibility actions there. AssistiveTouch and Switch Control are system features; a third-party app cannot programmatically enable them or inject arbitrary taps into other apps using public SDK APIs.

`IrisControl/GazeViewController.swift` is a small **app-local ARKit exploration starter**, not a complete iOS app or production gaze mapper. It projects ARKit's estimated face-relative look-at point into a scene and smooths the cursor. Add a calibrated screen mapping and dwell targets before treating that projection as useful interaction.

To explore:

1. On macOS with Xcode, create an iOS UIKit app (iOS 17+ is a practical starter target).
2. Add the Swift file and set `GazeViewController` as your scene's root view controller.
3. Add `NSCameraUsageDescription` to Info.plist: “Estimate gaze locally to explore hands-free control inside Iris Control.”
4. Link ARKit and SceneKit, choose a supported physical iPhone, and sign/run the app.
5. Pause the AR session when the app becomes inactive in your scene lifecycle. This skeleton pauses on view disappearance; app scene lifecycle integration is left to the host project.

There is no Xcode project, signing configuration, background camera entitlement, or simulated system touch API here. The file has not been compiled in this Windows environment.

Official guidance: [Apple Eye Tracking](https://support.apple.com/guide/iphone/iph66057d0f6/ios), [ARFaceAnchor](https://developer.apple.com/documentation/arkit/arfaceanchor), [lookAtPoint](https://developer.apple.com/documentation/arkit/arfaceanchor/lookatpoint).
