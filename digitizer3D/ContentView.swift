import SwiftUI
import WebKit
import CoreMotion
import CoreLocation

struct WebContainer: UIViewRepresentable {
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView
        
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
    
    class Coordinator: NSObject, UIScrollViewDelegate, CLLocationManagerDelegate {
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
            locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
            locationManager.requestWhenInUseAuthorization()
            locationManager.startUpdatingLocation()
            locationManager.startUpdatingHeading()
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
        
        func startMotionUpdates() {
            guard motionManager.isDeviceMotionAvailable else { return }
            
            motionManager.deviceMotionUpdateInterval = 1.0 / 30.0
            
            let availableFrames = CMMotionManager.availableAttitudeReferenceFrames()
            let referenceFrame: CMAttitudeReferenceFrame = availableFrames.contains(.xMagneticNorthZVertical)
                ? .xMagneticNorthZVertical
                : .xArbitraryCorrectedZVertical
            
            motionManager.startDeviceMotionUpdates(using: referenceFrame, to: .main) { [weak self] motion, error in
                guard let motion = motion, error == nil else { return }
                
                let (strike, dipDir, dip, rake) = self?.calculateGeologicalOrientation(motion: motion) ?? (0, 0, 0, 0)
                
                let jsCode = "if (window.handleNativeSensors) { window.handleNativeSensors(\(strike), \(dipDir), \(dip), \(rake)); }"
                self?.webView?.evaluateJavaScript(jsCode, completionHandler: nil)
            }
        }
        
        func calculateGeologicalOrientation(motion: CMDeviceMotion) -> (strike: Int, dipDir: Int, dip: Int, rake: Int) {
            let g = motion.gravity
            let m = motion.magneticField.field
            
            if motion.magneticField.accuracy != .uncalibrated && (m.x != 0 || m.y != 0 || m.z != 0) {
                return calculateFromDirectSensors(g: g, m: m)
            } else {
                return calculateFromRotationMatrix(motion: motion)
            }
        }
        
        private func calculateFromDirectSensors(g: CMAcceleration, m: CMMagneticField) -> (strike: Int, dipDir: Int, dip: Int, rake: Int) {
            let normG = sqrt(g.x * g.x + g.y * g.y + g.z * g.z)
            guard normG > 0 else { return (0, 0, 0, 0) }
            let up = (-g.x / normG, -g.y / normG, -g.z / normG)
            
            let eastX = g.y * m.z - g.z * m.y
            let eastY = g.z * m.x - g.x * m.z
            let eastZ = g.x * m.y - g.y * m.x
            let normE = sqrt(eastX * eastX + eastY * eastY + eastZ * eastZ)
            guard normE > 0 else { return (0, 0, 0, 0) }
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
            
            let yEast = east.1
            let yNorth = north.1
            
            let strikeRad = strikeDeg * .pi / 180.0
            let strikeEast = sin(strikeRad)
            let strikeNorth = cos(strikeRad)
            
            let dot = yEast * strikeEast + yNorth * strikeNorth
            let rakeRad = acos(min(max(dot, -1.0), 1.0))
            var rakeDeg = rakeRad * 180.0 / .pi
            
            // 🔄 Correzione rake: se lo schermo è rivolto verso l'alto (g.z < 0)
            if g.z < 0 {
                rakeDeg = 180.0 - rakeDeg
            }
            
            return (
                Int(round(strikeDeg)),
                Int(round(dipDirDeg)),
                Int(round(dipDeg)),
                Int(round(rakeDeg))
            )
        }
        
        private func calculateFromRotationMatrix(motion: CMDeviceMotion) -> (strike: Int, dipDir: Int, dip: Int, rake: Int) {
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
            
            let strikeRad = strikeDeg * .pi / 180.0
            let strikeNorth = cos(strikeRad)
            let strikeWest = -sin(strikeRad)
            
            let yNorth = r.m12
            let yWest = r.m22
            
            let dotProduct = yNorth * strikeNorth + yWest * strikeWest
            let rakeRad = acos(min(max(dotProduct, -1.0), 1.0))
            var rakeDeg = rakeRad * 180.0 / .pi
            
            // 🔄 Correzione rake: se lo schermo è rivolto verso l'alto (motion.gravity.z < 0)
            if motion.gravity.z < 0 {
                rakeDeg = 180.0 - rakeDeg
            }
            
            return (
                Int(round(strikeDeg)),
                Int(round(dipDirDeg)),
                Int(round(dipDeg)),
                Int(round(rakeDeg))
            )
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
