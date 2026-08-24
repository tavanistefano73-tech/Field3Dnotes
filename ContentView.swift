import SwiftUI
import WebKit
import CoreMotion
import CoreLocation
import UIKit
import AVFoundation
import ARKit
import SceneKit

struct FieldStorage {
    static var rootDir: URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    static var mediaDir: URL {
        let dir = rootDir.appendingPathComponent("media", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }
}

struct WebContainer: UIViewRepresentable {
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.setURLSchemeHandler(NoteMediaSchemeHandler(), forURLScheme: "notemedia")

        let userContentController = WKUserContentController()
        userContentController.add(context.coordinator, name: "saveNoteMedia")
        userContentController.add(context.coordinator, name: "deleteNoteMedia")
        userContentController.add(context.coordinator, name: "exportGeoJSON")
        userContentController.add(context.coordinator, name: "checkLiDARSupport")
        userContentController.add(context.coordinator, name: "startARMeasure")
        
        config.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView
        webView.uiDelegate = context.coordinator
        
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.delegate = context.coordinator
        
        if let htmlPath = Bundle.main.path(forResource: "index", ofType: "html") {
            let url = URL(fileURLWithPath: htmlPath)
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        
        context.coordinator.startMotionUpdates()
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class NoteMediaSchemeHandler: NSObject, WKURLSchemeHandler {
        func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
            guard let url = urlSchemeTask.request.url,
                  let filename = url.host?.removingPercentEncoding ?? url.path.removingPercentEncoding else {
                urlSchemeTask.didFailWithError(NSError(domain: "NoteMedia", code: 400))
                return
            }

            let cleanFilename = (filename as NSString).lastPathComponent
            let fileURL = FieldStorage.mediaDir.appendingPathComponent(cleanFilename)

            guard let data = try? Data(contentsOf: fileURL) else {
                urlSchemeTask.didFailWithError(NSError(domain: "NoteMedia", code: 404))
                return
            }

            let lowerFilename = cleanFilename.lowercased()
            let mimeType: String
            if lowerFilename.hasSuffix(".png") {
                mimeType = "image/png"
            } else if lowerFilename.hasSuffix(".m4a") || lowerFilename.hasSuffix(".mp4") {
                mimeType = "audio/mp4"
            } else {
                mimeType = "image/jpeg"
            }

            let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mimeType,
                    "Content-Length": String(data.count),
                    "Access-Control-Allow-Origin": "*"
                ]
            )!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }

        func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
    }
    
    class Coordinator: NSObject, UIScrollViewDelegate, CLLocationManagerDelegate, WKScriptMessageHandler, WKUIDelegate {
        weak var webView: WKWebView?
        let motionManager = CMMotionManager()
        let locationManager = CLLocationManager()
        
        var magneticDeclination: Double = 0.0
        
        override init() {
            super.init()
            setupLocationManager()
        }
        
        private func setupLocationManager() {
            locationManager.delegate = self
            locationManager.desiredAccuracy = kCLLocationAccuracyBest
            locationManager.requestWhenInUseAuthorization()
            locationManager.startUpdatingLocation()
            locationManager.startUpdatingHeading()
        }
        
        // MARK: - GPS Update (da ContentView_3)
        func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
            guard let location = locations.last else { return }
            
            let latStr = String(format: "%.6f", locale: Locale(identifier: "en_US"), location.coordinate.latitude)
            let lngStr = String(format: "%.6f", locale: Locale(identifier: "en_US"), location.coordinate.longitude)
            let altStr = String(format: "%.1f", locale: Locale(identifier: "en_US"), location.altitude)
            
            let jsCode = "if (window.handleNativeLocation) { window.handleNativeLocation(\(latStr), \(lngStr), \(altStr)); }"
            
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(jsCode, completionHandler: nil)
            }
        }
        
        func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
            if newHeading.trueHeading >= 0 {
                let declination = newHeading.trueHeading - newHeading.magneticHeading
                self.magneticDeclination = declination
            }
        }
        
        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            scrollView.contentOffset = .zero
        }
        
        // MARK: - WKUIDelegate
        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            guard let topVC = getTopViewController() else {
                completionHandler(nil)
                return
            }
            
            let alert = UIAlertController(title: prompt, message: nil, preferredStyle: .alert)
            alert.addTextField { textField in
                textField.text = defaultText
            }
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                completionHandler(alert.textFields?.first?.text)
            })
            alert.addAction(UIAlertAction(title: "Annulla", style: .cancel) { _ in
                completionHandler(nil)
            })
            topVC.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            guard let topVC = getTopViewController() else {
                completionHandler()
                return
            }
            
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                completionHandler()
            })
            topVC.present(alert, animated: true)
        }
        
        // MARK: - Motion Sensors (6 parametri completa)
        func startMotionUpdates() {
            configureAudioSession()
            guard motionManager.isDeviceMotionAvailable else { return }
            
            motionManager.deviceMotionUpdateInterval = 1.0 / 30.0
            
            let availableFrames = CMMotionManager.availableAttitudeReferenceFrames()
            let referenceFrame: CMAttitudeReferenceFrame = availableFrames.contains(.xMagneticNorthZVertical)
                ? .xMagneticNorthZVertical
                : .xArbitraryCorrectedZVertical
            
            motionManager.startDeviceMotionUpdates(using: referenceFrame, to: .main) { [weak self] motion, error in
                guard let motion = motion, error == nil else { return }
                
                let (strike, dipDir, dip, rake, trend, plunge) = self?.calculateGeologicalOrientation(motion: motion) ?? (0, 0, 0, 0, 0, 0)

                let jsCode = "if (window.handleNativeSensors) { window.handleNativeSensors(\(strike), \(dipDir), \(dip), \(rake), \(trend), \(plunge)); }"
                
                self?.webView?.evaluateJavaScript(jsCode, completionHandler: nil)
            }
        }
        
        func calculateGeologicalOrientation(motion: CMDeviceMotion) -> (strike: Int, dipDir: Int, dip: Int, rake: Int, trend: Int, plunge: Int) {
            let g = motion.gravity
            let m = motion.magneticField.field
            
            if motion.magneticField.accuracy != .uncalibrated && (m.x != 0 || m.y != 0 || m.z != 0) {
                return calculateFromDirectSensors(g: g, m: m)
            } else {
                return calculateFromRotationMatrix(motion: motion)
            }
        }
        
        private func calculateFromDirectSensors(g: CMAcceleration, m: CMMagneticField) -> (strike: Int, dipDir: Int, dip: Int, rake: Int, trend: Int, plunge: Int) {
            let normG = sqrt(g.x * g.x + g.y * g.y + g.z * g.z)
            guard normG > 0 else { return (0, 0, 0, 0, 0, 0) }
            let up = (-g.x / normG, -g.y / normG, -g.z / normG)
            
            let eastX = g.y * m.z - g.z * m.y
            let eastY = g.z * m.x - g.x * m.z
            let eastZ = g.x * m.y - g.y * m.x
            let normE = sqrt(eastX * eastX + eastY * eastY + eastZ * eastZ)
            guard normE > 0 else { return (0, 0, 0, 0, 0, 0) }
            let east = (eastX / normE, eastY / normE, eastZ / normE)
            
            let north = (
                up.1 * east.2 - up.2 * east.1,
                up.2 * east.0 - up.0 * east.2,
                up.0 * east.1 - up.1 * east.0
            )
            
            let nEast = east.2
            let nNorth = north.2
            let nUp = up.2
            
            let dipRad = acos(min(max(abs(nUp), 0.0), 1.0))
            let dipDeg = dipRad * 180.0 / .pi
            
            var dipDirDeg = atan2(nEast, nNorth) * 180.0 / .pi - magneticDeclination
            if dipDirDeg < 0 { dipDirDeg += 360.0 }
            if dipDirDeg >= 360 { dipDirDeg -= 360.0 }
            
            var strikeDeg = dipDirDeg - 90.0
            if strikeDeg < 0 { strikeDeg += 360.0 }
            
            let yUp = up.1
            let xUp = up.0
            
            var rakeRad = atan2(yUp, -xUp)
            var rakeDeg = rakeRad * 180.0 / .pi
            if rakeDeg < 0 { rakeDeg += 360.0 }
            if rakeDeg >= 360 { rakeDeg -= 360.0 }
            
            if g.z < 0 { rakeDeg = 180.0 - rakeDeg }
            if g.y > 0 { rakeDeg = 180.0 - rakeDeg }
            if rakeDeg < 0 { rakeDeg += 360.0 }

            var teE = east.1, teN = north.1, teU = up.1
            if teU > 0 { teE = -teE; teN = -teN; teU = -teU }

            var trendDeg = atan2(teE, teN) * 180.0 / .pi - magneticDeclination
            if trendDeg < 0 { trendDeg += 360.0 }
            if trendDeg >= 360 { trendDeg -= 360.0 }

            let plungeDeg = asin(min(max(-teU, 0.0), 1.0)) * 180.0 / .pi

            if dipDeg < 1.0 {
                return (0, 0, 0, 0, Int(round(trendDeg)), Int(round(plungeDeg)))
            }
            if rakeDeg > 180.0 {
                rakeDeg = 360.0 - rakeDeg
            }
            return (
                Int(round(strikeDeg)),
                Int(round(dipDirDeg)),
                Int(round(dipDeg)),
                Int(round(rakeDeg)),
                Int(round(trendDeg)),
                Int(round(plungeDeg))
            )
        }

        private func calculateFromRotationMatrix(motion: CMDeviceMotion) -> (strike: Int, dipDir: Int, dip: Int, rake: Int, trend: Int, plunge: Int) {
            let r = motion.attitude.rotationMatrix
            
            let Nx = r.m13
            let Ny = r.m23
            let Nz = r.m33
            
            let dipRad = acos(min(max(abs(Nz), 0.0), 1.0))
            let dipDeg = dipRad * 180.0 / .pi
            
            var dipDirDeg = atan2(Nx, Ny) * 180.0 / .pi - magneticDeclination
            if dipDirDeg < 0 { dipDirDeg += 360.0 }
            if dipDirDeg >= 360 { dipDirDeg -= 360.0 }
            
            var strikeDeg = dipDirDeg - 90.0
            if strikeDeg < 0 { strikeDeg += 360.0 }
            
            let yUp = r.m32
            let xUp = r.m31
            
            var rakeRad = atan2(yUp, -xUp)
            var rakeDeg = rakeRad * 180.0 / .pi
            if rakeDeg < 0 { rakeDeg += 360.0 }
            if rakeDeg >= 360 { rakeDeg -= 360.0 }
            
            if motion.gravity.z < 0 { rakeDeg = 180.0 - rakeDeg }
            if motion.gravity.y > 0 { rakeDeg = 180.0 - rakeDeg }
            if rakeDeg < 0 { rakeDeg += 360.0 }

            let yEast = r.m12
            let yNorth = r.m22
            
            var teE = yEast, teN = yNorth, teU = yUp
            if teU > 0 { teE = -teE; teN = -teN; teU = -teU }

            var trendDeg = atan2(teE, teN) * 180.0 / .pi - magneticDeclination
            if trendDeg < 0 { trendDeg += 360.0 }
            if trendDeg >= 360 { trendDeg -= 360.0 }

            let plungeDeg = asin(min(max(-teU, 0.0), 1.0)) * 180.0 / .pi

            if dipDeg < 1.0 {
                return (0, 0, 0, 0, Int(round(trendDeg)), Int(round(plungeDeg)))
            }

            return (
                Int(round(strikeDeg)),
                Int(round(dipDirDeg)),
                Int(round(dipDeg)),
                Int(round(rakeDeg)),
                Int(round(trendDeg)),
                Int(round(plungeDeg))
            )
        }
        
        // MARK: - Handlers JS Completi
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "checkLiDARSupport" {
                let isLiDARSupported = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
                let js = "if (window.setLiDARSupport) { window.setLiDARSupport(\(isLiDARSupported)); }"
                DispatchQueue.main.async { [weak self] in
                    self?.webView?.evaluateJavaScript(js, completionHandler: nil)
                }
            }
            else if message.name == "startARMeasure" {
                DispatchQueue.main.async { [weak self] in
                    guard let topVC = self?.getTopViewController() else { return }
                    self?.presentARMeasurementController(from: topVC)
                }
            }
            else if message.name == "exportGeoJSON" {
                guard let body = message.body as? [String: Any],
                      let jsonString = body["jsonString"] as? String else { return }
                
                let filename = (body["filename"] as? String) ?? "data.geojson"
                exportGeoJSONFile(jsonString: jsonString, filename: filename)
            }
            else if message.name == "saveNoteMedia" {
                guard let body = message.body as? [String: Any],
                      let filename = body["filename"] as? String,
                      let base64 = body["base64"] as? String,
                      let data = Data(base64Encoded: base64) else {
                    replyToJS(callbackId: (message.body as? [String: Any])?["callbackId"] as? String, success: false)
                    return
                }

                let cleanFilename = (filename as NSString).lastPathComponent
                let fileURL = FieldStorage.mediaDir.appendingPathComponent(cleanFilename)

                do {
                    try data.write(to: fileURL, options: .atomic)
                    replyToJS(callbackId: body["callbackId"] as? String, success: true)
                } catch {
                    replyToJS(callbackId: body["callbackId"] as? String, success: false)
                }
            }
            else if message.name == "deleteNoteMedia" {
                guard let body = message.body as? [String: Any],
                      let filename = body["filename"] as? String else { return }

                let cleanFilename = (filename as NSString).lastPathComponent
                let fileURL = FieldStorage.mediaDir.appendingPathComponent(cleanFilename)
                try? FileManager.default.removeItem(at: fileURL)
            }
        }

        func presentARMeasurementController(from viewController: UIViewController) {
            let arVC = ARMeasureViewController()
            arVC.onDistanceMeasured = { [weak self] distanceInMeters in
                let formattedDistance = String(format: "%.2f m", distanceInMeters)
                let jsCode = "if (window.onLiDARMeasurementComplete) { window.onLiDARMeasurementComplete('\(formattedDistance)'); }"
                DispatchQueue.main.async {
                    self?.webView?.evaluateJavaScript(jsCode, completionHandler: nil)
                }
            }
            arVC.modalPresentationStyle = .fullScreen
            viewController.present(arVC, animated: true)
        }

        // Salvataggio GeoJSON nella cartella Field3Dnotes con feedback a JS
        func exportGeoJSONFile(jsonString: String, filename: String) {
            let cleanFilename = (filename as NSString).lastPathComponent
            let safeName = cleanFilename.isEmpty ? "data.geojson" : cleanFilename
            
            // ✅ Salva direttamente in rootDir
            let fileURL = FieldStorage.rootDir.appendingPathComponent(safeName)
            
            do {
                try jsonString.write(to: fileURL, atomically: true, encoding: .utf8)
                print("✅ File saved: \(fileURL.path)")
                
                let message = "File saved! 💾\n\(safeName)"
                let escapedMessage = message.replacingOccurrences(of: "\"", with: "\\\"").replacingOccurrences(of: "\n", with: "\\n")
                
                DispatchQueue.main.async { [weak self] in
                    self?.webView?.evaluateJavaScript("if (window.onGeoJSONSaveComplete) { window.onGeoJSONSaveComplete(); if (window.updateStatus) updateStatus('\(escapedMessage)', '#28a745'); }", completionHandler: nil)
                }
            } catch {
                print("❌ Error saving GeoJSON: \(error)")
                DispatchQueue.main.async { [weak self] in
                    self?.webView?.evaluateJavaScript("if (window.onGeoJSONSaveComplete) window.onGeoJSONSaveComplete();", completionHandler: nil)
                }
            }
        }

        private func getTopViewController() -> UIViewController? {
            guard var topVC = webView?.window?.rootViewController ?? UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow })?.rootViewController else { return nil }
            
            while let presented = topVC.presentedViewController {
                topVC = presented
            }
            return topVC
        }

        private func replyToJS(callbackId: String?, success: Bool) {
            guard let callbackId = callbackId else { return }
            let jsCode = "if (window.__noteMediaCallback) { window.__noteMediaCallback('\(callbackId)', \(success)); }"
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(jsCode, completionHandler: nil)
            }
        }

        @available(iOS 15.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }
        @available(iOS 15.0, *)
        func webView(_ webView: WKWebView,
                     requestGeolocationPermissionForOrigin origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }
        
        
        deinit {
            motionManager.stopDeviceMotionUpdates()
            locationManager.stopUpdatingHeading()
            locationManager.stopUpdatingLocation()
        }
    }
}

struct ContentView: View {
    var body: some View {
        WebContainer()
            .ignoresSafeArea(.keyboard, edges: .bottom)
    }
}

func configureAudioSession() {
    do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
        try session.setActive(true)
    } catch {
        print("Errore nella configurazione di AVAudioSession: \(error)")
    }
}

class ARMeasureViewController: UIViewController, ARSCNViewDelegate {

    var sceneView: ARSCNView!
    var infoLabel: UILabel!
    var acquireButton: UIButton!
    var reticleView: UIView!

    var firstPoint: SCNVector3?
    var firstNode: SCNNode?
    var liveNode: SCNNode?
    var lineNode: SCNNode?
    
    var currentDistance: Float = 0.0
    var onDistanceMeasured: ((Float) -> Void)?

    override func viewDidLoad() {
        super.viewDidLoad()

        sceneView = ARSCNView(frame: view.bounds)
        sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        sceneView.delegate = self
        view.addSubview(sceneView)

        infoLabel = UILabel()
        infoLabel.text = "Tocca lo schermo per impostare il primo punto"
        infoLabel.textColor = .white
        infoLabel.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        infoLabel.textAlignment = .center
        infoLabel.font = UIFont.boldSystemFont(ofSize: 16)
        infoLabel.layer.cornerRadius = 8
        infoLabel.clipsToBounds = true
        infoLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(infoLabel)

        acquireButton = UIButton(type: .system)
        acquireButton.setTitle("🎯 Acquire Measure", for: .normal)
        acquireButton.setTitleColor(.white, for: .normal)
        acquireButton.backgroundColor = UIColor.systemGreen
        acquireButton.titleLabel?.font = UIFont.boldSystemFont(ofSize: 18)
        acquireButton.layer.cornerRadius = 12
        acquireButton.isHidden = true
        acquireButton.translatesAutoresizingMaskIntoConstraints = false
        acquireButton.addTarget(self, action: #selector(acquireMeasurePressed), for: .touchUpInside)
        view.addSubview(acquireButton)

        reticleView = UIView()
        reticleView.backgroundColor = UIColor.white.withAlphaComponent(0.8)
        reticleView.layer.cornerRadius = 3
        reticleView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(reticleView)

        NSLayoutConstraint.activate([
            infoLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            infoLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            infoLabel.heightAnchor.constraint(equalToConstant: 40),
            infoLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 240),

            acquireButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -30),
            acquireButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            acquireButton.heightAnchor.constraint(equalToConstant: 50),
            acquireButton.widthAnchor.constraint(equalToConstant: 200),

            reticleView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            reticleView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            reticleView.widthAnchor.constraint(equalToConstant: 6),
            reticleView.heightAnchor.constraint(equalToConstant: 6)
        ])

        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        sceneView.addGestureRecognizer(tapGesture)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let configuration = ARWorldTrackingConfiguration()
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
        }
        sceneView.session.run(configuration)
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sceneView.session.pause()
    }

    @objc func handleTap(_ gesture: UITapGestureRecognizer) {
        let centerPoint = CGPoint(x: view.bounds.midX, y: view.bounds.midY)
        guard let query = sceneView.raycastQuery(from: centerPoint, allowing: .estimatedPlane, alignment: .any),
              let result = sceneView.session.raycast(query).first else { return }

        let position = SCNVector3(
            result.worldTransform.columns.3.x,
            result.worldTransform.columns.3.y,
            result.worldTransform.columns.3.z
        )

        firstNode?.removeFromParentNode()
        firstNode = createSphereNode(color: .green, position: position)
        sceneView.scene.rootNode.addChildNode(firstNode!)
        
        firstPoint = position
        acquireButton.isHidden = false
    }

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        guard let firstP = firstPoint else { return }

        let centerPoint = CGPoint(x: view.bounds.midX, y: view.bounds.midY)
        guard let query = sceneView.raycastQuery(from: centerPoint, allowing: .estimatedPlane, alignment: .any),
              let result = sceneView.session.raycast(query).first else { return }

        let livePosition = SCNVector3(
            result.worldTransform.columns.3.x,
            result.worldTransform.columns.3.y,
            result.worldTransform.columns.3.z
        )

        let dx = livePosition.x - firstP.x
        let dy = livePosition.y - firstP.y
        let dz = livePosition.z - firstP.z
        currentDistance = sqrt(dx*dx + dy*dy + dz*dz)

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.infoLabel.text = String(format: "Distanza: %.2f m", self.currentDistance)

            self.liveNode?.removeFromParentNode()
            self.liveNode = self.createSphereNode(color: .red, position: livePosition)
            self.sceneView.scene.rootNode.addChildNode(self.liveNode!)

            self.lineNode?.removeFromParentNode()
            self.lineNode = self.createDashedLineNode(from: firstP, to: livePosition)
            self.sceneView.scene.rootNode.addChildNode(self.lineNode!)
        }
    }

    @objc func acquireMeasurePressed() {
        guard firstPoint != nil else { return }
        onDistanceMeasured?(currentDistance)
        dismiss(animated: true, completion: nil)
    }

    private func createSphereNode(color: UIColor, position: SCNVector3) -> SCNNode {
        let sphere = SCNSphere(radius: 0.008)
        sphere.firstMaterial?.diffuse.contents = color
        sphere.firstMaterial?.lightingModel = .constant

        let node = SCNNode(geometry: sphere)
        node.position = position

        if let cameraTransform = sceneView.session.currentFrame?.camera.transform {
            let cameraPos = SCNVector3(cameraTransform.columns.3.x, cameraTransform.columns.3.y, cameraTransform.columns.3.z)
            let dist = sqrt(pow(position.x - cameraPos.x, 2) + pow(position.y - cameraPos.y, 2) + pow(position.z - cameraPos.z, 2))
            let scaleFactor = max(dist, 0.2)
            node.scale = SCNVector3(scaleFactor, scaleFactor, scaleFactor)
        }
        return node
    }

    private func createDashedLineNode(from p1: SCNVector3, to p2: SCNVector3) -> SCNNode {
        let node = SCNNode()
        let distance = sqrt(pow(p2.x - p1.x, 2) + pow(p2.y - p1.y, 2) + pow(p2.z - p1.z, 2))
        
        let dashLength: Float = 0.03
        let gapLength: Float = 0.02
        let step = dashLength + gapLength
        
        var currentDist: Float = 0.0
        
        while currentDist < distance {
            let t1 = currentDist / distance
            let t2 = min((currentDist + dashLength) / distance, 1.0)
            
            let start = SCNVector3(p1.x + t1*(p2.x - p1.x), p1.y + t1*(p2.y - p1.y), p1.z + t1*(p2.z - p1.z))
            let end = SCNVector3(p1.x + t2*(p2.x - p1.x), p1.y + t2*(p2.y - p1.y), p1.z + t2*(p2.z - p1.z))
            
            let indices: [Int32] = [0, 1]
            let source = SCNGeometrySource(vertices: [start, end])
            let element = SCNGeometryElement(indices: indices, primitiveType: .line)
            let segmentGeometry = SCNGeometry(sources: [source], elements: [element])
            segmentGeometry.firstMaterial?.diffuse.contents = UIColor.yellow
            segmentGeometry.firstMaterial?.lightingModel = .constant
            
            node.addChildNode(SCNNode(geometry: segmentGeometry))
            currentDist += step
        }
        
        return node
    }
}
