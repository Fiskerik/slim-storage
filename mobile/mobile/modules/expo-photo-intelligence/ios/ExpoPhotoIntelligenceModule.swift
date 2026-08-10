import ExpoModulesCore
import ImageIO
import Photos
import UIKit
import Vision

// All analysis stays on the device. This module deliberately does not use
// Foundation Models: Vision is available on a much wider range of iPhones.
public final class ExpoPhotoIntelligenceModule: Module {
  private let maximumAssetsPerBatch = 120

  public func definition() -> ModuleDefinition {
    Name("ExpoPhotoIntelligence")

    Function("getCapabilities") {
      var capabilities: [String: Any] = [
        "featurePrint": true,
        "faceCaptureQuality": false,
        "imageAesthetics": false,
        "maximumAssetsPerBatch": self.maximumAssetsPerBatch,
      ]

      if #available(iOS 15.0, *) {
        capabilities["faceCaptureQuality"] = true
      }
      if #available(iOS 18.0, *) {
        capabilities["imageAesthetics"] = true
      }
      return capabilities
    }

    // Returns independent signals for every asset. Callers may combine them with
    // product signals such as favourite status and file size when choosing a keeper.
    AsyncFunction("analyzeAssets") { (localIdentifiers: [String]) async -> [[String: Any]] in
      let assets = self.fetchAssets(localIdentifiers: localIdentifiers)
      return await self.analyze(assets: assets).map(\.record)
    }

    // Vision feature-print distances are only meaningful relative to the same
    // request revision. Keep comparison and clustering in native code for that reason.
    AsyncFunction("findSimilarAssets") { (localIdentifiers: [String], threshold: Double) async -> [String: Any] in
      let inputWasLimited = localIdentifiers.count > self.maximumAssetsPerBatch
      let identifiers = Array(localIdentifiers.prefix(self.maximumAssetsPerBatch))
      let assets = self.fetchAssets(localIdentifiers: identifiers)
      let analyses = await self.analyze(assets: assets)
      let boundedThreshold = min(max(threshold, 0.1), 100.0)
      var pairs: [[String: Any]] = []

      for firstIndex in analyses.indices {
        guard let firstPrint = analyses[firstIndex].featurePrint else { continue }
        for secondIndex in analyses.indices.dropFirst(firstIndex + 1) {
          guard let secondPrint = analyses[secondIndex].featurePrint else { continue }
          var distance: Float = 0
          do {
            try firstPrint.computeDistance(&distance, to: secondPrint)
            if Double(distance) <= boundedThreshold {
              pairs.append([
                "firstAssetId": analyses[firstIndex].localIdentifier,
                "secondAssetId": analyses[secondIndex].localIdentifier,
                "distance": Double(distance),
              ])
            }
          } catch {
            // A failed comparison affects only this pair. The individual records
            // below still describe what the device could analyze.
          }
        }
      }

      return [
        "items": analyses.map(\.record),
        "pairs": pairs,
        "limited": inputWasLimited,
        "processedCount": analyses.count,
      ]
    }
  }

  private struct AssetAnalysis {
    let localIdentifier: String
    let record: [String: Any]
    let featurePrint: VNFeaturePrintObservation?
  }

  private func fetchAssets(localIdentifiers: [String]) -> [PHAsset] {
    let result = PHAsset.fetchAssets(withLocalIdentifiers: localIdentifiers, options: nil)
    var assets: [PHAsset] = []
    result.enumerateObjects { asset, _, _ in assets.append(asset) }
    return assets
  }

  private func analyze(assets: [PHAsset]) async -> [AssetAnalysis] {
    var analyses: [AssetAnalysis] = []
    for asset in assets {
      analyses.append(await analyze(asset: asset))
    }
    return analyses
  }

  private func analyze(asset: PHAsset) async -> AssetAnalysis {
    var record: [String: Any] = [
      "assetId": asset.localIdentifier,
      "isScreenshot": asset.mediaSubtypes.contains(.photoScreenshot),
      "isUtility": asset.mediaSubtypes.contains(.photoScreenshot),
      "analysisAvailable": false,
    ]

    guard asset.mediaType == .image, let image = await previewImage(for: asset), let cgImage = image.cgImage else {
      record["unavailableReason"] = "image-not-available-on-device"
      return AssetAnalysis(localIdentifier: asset.localIdentifier, record: record, featurePrint: nil)
    }

    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: image.imageOrientation.cgImagePropertyOrientation)
    let featureRequest = VNGenerateImageFeaturePrintRequest()
    var featurePrint: VNFeaturePrintObservation?

    do {
      try handler.perform([featureRequest])
      featurePrint = featureRequest.results?.first
      record["analysisAvailable"] = featurePrint != nil
    } catch {
      record["unavailableReason"] = "vision-feature-print-failed"
    }

    if #available(iOS 15.0, *) {
      let faceRequest = VNDetectFaceCaptureQualityRequest()
      do {
        try handler.perform([faceRequest])
        let quality = faceRequest.results?
          .compactMap { $0.faceCaptureQuality }
          .max()
        if let quality {
          record["bestFaceCaptureQuality"] = Double(quality)
        }
      } catch {
        // Face quality is optional; a no-face photo is still fully analyzable.
      }
    }

    if #available(iOS 18.0, *) {
      let aestheticsRequest = VNCalculateImageAestheticsScoresRequest()
      do {
        try handler.perform([aestheticsRequest])
        if let result = aestheticsRequest.results?.first {
          record["aestheticScore"] = Double(result.overallScore)
          record["isUtility"] = result.isUtility
        }
      } catch {
        // The score is an enhancement only; feature prints remain the fallback.
      }
    }

    return AssetAnalysis(localIdentifier: asset.localIdentifier, record: record, featurePrint: featurePrint)
  }

  private func previewImage(for asset: PHAsset) async -> UIImage? {
    await withCheckedContinuation { continuation in
      let options = PHImageRequestOptions()
      options.deliveryMode = .highQualityFormat
      options.resizeMode = .fast
      options.isNetworkAccessAllowed = false
      options.isSynchronous = false

      PHImageManager.default().requestImage(
        for: asset,
        targetSize: CGSize(width: 1024, height: 1024),
        contentMode: .aspectFit,
        options: options
      ) { image, info in
        // Ignore degraded previews: comparing them with full previews produces
        // unstable feature-print distances.
        if (info?[PHImageResultIsDegradedKey] as? Bool) == true { return }
        continuation.resume(returning: image)
      }
    }
  }
}

private extension UIImage.Orientation {
  var cgImagePropertyOrientation: CGImagePropertyOrientation {
    switch self {
    case .up: return .up
    case .upMirrored: return .upMirrored
    case .down: return .down
    case .downMirrored: return .downMirrored
    case .left: return .left
    case .leftMirrored: return .leftMirrored
    case .right: return .right
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}