import UIKit
import ARKit

/// App-local exploration only. Public iOS APIs do not inject touches into other apps.
final class GazeViewController: UIViewController, ARSessionDelegate {
    private let session = ARSession()
    private let cursor = UIView(frame: CGRect(x: 0, y: 0, width: 24, height: 24))
    private let status = UILabel()
    private let scene = ARSCNView()
    private var filtered: CGPoint?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.06, green: 0.07, blue: 0.13, alpha: 1)
        scene.frame = view.bounds
        scene.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        scene.session = session
        view.addSubview(scene)
        status.text = "App-local gaze exploration · no system control"
        status.textColor = .white
        status.numberOfLines = 0
        status.frame = CGRect(x: 24, y: 64, width: 320, height: 80)
        view.addSubview(status)
        cursor.backgroundColor = UIColor(red: 0.65, green: 0.70, blue: 0.99, alpha: 1)
        cursor.layer.cornerRadius = 12
        cursor.isUserInteractionEnabled = false
        cursor.isHidden = true
        view.addSubview(cursor)
        session.delegate = self
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard ARFaceTrackingConfiguration.isSupported else {
            status.text = "ARKit face tracking is unavailable. Use Settings → Accessibility → Eye Tracking on supported iPhones."
            return
        }
        session.run(ARFaceTrackingConfiguration(), options: [.resetTracking, .removeExistingAnchors])
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        session.pause()
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        guard let face = anchors.compactMap({ $0 as? ARFaceAnchor }).first, face.isTracked else {
            DispatchQueue.main.async { self.cursor.isHidden = true; self.filtered = nil }
            return
        }
        let local = SIMD4<Float>(face.lookAtPoint.x, face.lookAtPoint.y, face.lookAtPoint.z, 1)
        let world = face.transform * local
        DispatchQueue.main.async {
            // Projection is exploratory; a real calibrated mapping is still required.
            let projected = self.scene.projectPoint(SCNVector3(world.x, world.y, world.z))
            guard projected.z > 0 && projected.z < 1 else { self.cursor.isHidden = true; return }
            let p = CGPoint(x: CGFloat(projected.x), y: CGFloat(projected.y))
            let old = self.filtered ?? p
            let next = CGPoint(x: old.x + 0.25 * (p.x - old.x), y: old.y + 0.25 * (p.y - old.y))
            self.filtered = next
            self.cursor.center = next
            self.cursor.isHidden = false
        }
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        DispatchQueue.main.async { self.status.text = error.localizedDescription; self.cursor.isHidden = true }
    }

    func sessionWasInterrupted(_ session: ARSession) {
        DispatchQueue.main.async { self.cursor.isHidden = true; self.filtered = nil }
    }
}
