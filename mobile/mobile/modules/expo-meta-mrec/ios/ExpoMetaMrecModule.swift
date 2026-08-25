import ExpoModulesCore
import FBAudienceNetwork
import Foundation
import UIKit

public final class ExpoMetaMrecModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoMetaMrec")

    View(MetaMrecAdView.self) {
      Events("onAdLoaded", "onAdFailed", "onAdClicked", "onAdImpression")

      Prop("placementId") { (view: MetaMrecAdView, placementId: String) in
        view.setPlacementId(placementId)
      }

      OnViewDidUpdateProps { view in
        view.loadIfNeeded()
      }
    }
  }
}

private enum MetaMrecSdk {
  private static var initializationStarted = false
  private static var initializationFinished = false
  private static var initializationError: String?
  private static var callbacks: [(Bool, String?) -> Void] = []

  static func initialize(completion: @escaping (Bool, String?) -> Void) {
    dispatchPrecondition(condition: .onQueue(.main))

    if initializationFinished {
      completion(initializationError == nil, initializationError)
      return
    }

    callbacks.append(completion)
    guard !initializationStarted else { return }
    initializationStarted = true

    FBAudienceNetworkAds.initialize(with: nil) { result in
      DispatchQueue.main.async {
        initializationFinished = true
        initializationError = result.isSuccess ? nil : result.message
        let pendingCallbacks = callbacks
        callbacks.removeAll()
        pendingCallbacks.forEach { callback in
          callback(result.isSuccess, initializationError)
        }
      }
    }
  }
}

public final class MetaMrecAdView: ExpoView, FBAdViewDelegate {
  private let onAdLoaded = EventDispatcher()
  private let onAdFailed = EventDispatcher()
  private let onAdClicked = EventDispatcher()
  private let onAdImpression = EventDispatcher()

  private var placementId: String?
  private var requestedPlacementId: String?
  private var adView: FBAdView?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    clipsToBounds = true
  }

  func setPlacementId(_ placementId: String) {
    let normalized = placementId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard self.placementId != normalized else { return }
    teardownAd()
    self.placementId = normalized
    requestedPlacementId = nil
  }

  func loadIfNeeded() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in self?.loadIfNeeded() }
      return
    }
    guard let placementId, !placementId.isEmpty, requestedPlacementId != placementId else { return }
    requestedPlacementId = placementId

    MetaMrecSdk.initialize { [weak self] success, message in
      guard let self, self.requestedPlacementId == placementId else { return }
      guard success else {
        self.emitFailure(code: -2, domain: "FBAudienceNetwork", message: message ?? "Meta SDK initialization failed.")
        return
      }
      self.createAndLoadAd(placementId: placementId)
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    adView?.frame = bounds
  }

  public override func removeFromSuperview() {
    teardownAd()
    super.removeFromSuperview()
  }

  private func createAndLoadAd(placementId: String) {
    guard let viewController = appContext?.utilities?.currentViewController() else {
      emitFailure(code: -3, domain: "ExpoMetaMrec", message: "No presenting iOS view controller was available.")
      return
    }

    let view = FBAdView(
      placementID: placementId,
      adSize: kFBAdSizeHeight250Rectangle,
      rootViewController: viewController
    )
    view.delegate = self
    view.frame = bounds
    view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.isHidden = true
    addSubview(view)
    adView = view
    view.loadAd()
  }

  private func teardownAd() {
    adView?.delegate = nil
    adView?.removeFromSuperview()
    adView = nil
  }

  private func emitFailure(code: Int, domain: String, message: String) {
    teardownAd()
    onAdFailed([
      "code": code,
      "domain": domain,
      "message": message,
    ])
  }

  public func adViewDidLoad(_ adView: FBAdView) {
    guard adView === self.adView else { return }
    adView.isHidden = false
    onAdLoaded([:])
  }

  public func adView(_ adView: FBAdView, didFailWithError error: Error) {
    guard adView === self.adView else { return }
    let nsError = error as NSError
    emitFailure(code: nsError.code, domain: nsError.domain, message: nsError.localizedDescription)
  }

  public func adViewDidClick(_ adView: FBAdView) {
    guard adView === self.adView else { return }
    onAdClicked([:])
  }

  public func adViewWillLogImpression(_ adView: FBAdView) {
    guard adView === self.adView else { return }
    onAdImpression([:])
  }
}
