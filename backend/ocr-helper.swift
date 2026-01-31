import Foundation
import Vision
import AppKit

struct OCRResult: Codable {
    let text: String
    let confidence: Double
}

struct OCRError: Codable {
    let error: String
}

func performOCR(imagePath: String) {
    guard let image = NSImage(contentsOfFile: imagePath) else {
        let error = OCRError(error: "Failed to load image")
        if let jsonData = try? JSONEncoder().encode(error),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
        exit(1)
    }

    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        let error = OCRError(error: "Failed to create CGImage")
        if let jsonData = try? JSONEncoder().encode(error),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
        exit(1)
    }

    let request = VNRecognizeTextRequest { request, error in
        if let error = error {
            let errorResult = OCRError(error: error.localizedDescription)
            if let jsonData = try? JSONEncoder().encode(errorResult),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                print(jsonString)
            }
            exit(1)
        }

        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            let result = OCRResult(text: "", confidence: 0)
            if let jsonData = try? JSONEncoder().encode(result),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                print(jsonString)
            }
            return
        }

        var allText: [String] = []
        var totalConfidence: Double = 0
        var count: Int = 0

        for observation in observations {
            if let topCandidate = observation.topCandidates(1).first {
                allText.append(topCandidate.string)
                totalConfidence += Double(topCandidate.confidence)
                count += 1
            }
        }

        let averageConfidence = count > 0 ? totalConfidence / Double(count) : 0
        let result = OCRResult(text: allText.joined(separator: "\n"), confidence: averageConfidence)

        if let jsonData = try? JSONEncoder().encode(result),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    }

    // Configure for accurate recognition
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    do {
        try handler.perform([request])
    } catch {
        let errorResult = OCRError(error: error.localizedDescription)
        if let jsonData = try? JSONEncoder().encode(errorResult),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
        exit(1)
    }
}

// Main execution
guard CommandLine.arguments.count > 1 else {
    let error = OCRError(error: "Usage: ocr-helper <image-path>")
    if let jsonData = try? JSONEncoder().encode(error),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    }
    exit(1)
}

let imagePath = CommandLine.arguments[1]
performOCR(imagePath: imagePath)
