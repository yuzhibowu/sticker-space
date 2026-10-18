import Foundation
import AVFoundation
@main struct ValidateMobileCore {
  static func main() async throws {
    let source=AVURLAsset(url:URL(fileURLWithPath:CommandLine.arguments[1]))
    let directory=URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true)
    try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
    let track=try await source.loadTracks(withMediaType:.video).first!
    let size=try await track.load(.naturalSize),rate=try await track.load(.nominalFrameRate)
    let fps=Int(rate.rounded()),duration=Int(try await source.load(.duration).seconds.rounded()),frames=fps*duration
    let writer=try LivePhotoWriter(output:directory.appendingPathComponent("mobile-core.zip"),fps:fps,totalFrames:frames,width:Int(size.width),height:Int(size.height),coverFrame:frames/2)
    let reader=try AVAssetReader(asset:source)
    let output=AVAssetReaderTrackOutput(track:track,outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
    reader.add(output);guard reader.startReading() else {throw reader.error!}
    while let sample=output.copyNextSampleBuffer() {try writer.appendPixel(CMSampleBufferGetImageBuffer(sample)!)}
    guard reader.status == .completed else {throw reader.error!}
    try writer.finish()
    let manifest:[String:Any]=["image":writer.imageURL.lastPathComponent,"video":writer.movieURL.lastPathComponent,"assetIdentifier":writer.identifier,"fps":fps,"duration":duration,"coverFrame":frames/2,"coverTime":Double(frames/2)/Double(fps)]
    try JSONSerialization.data(withJSONObject:manifest,options:.prettyPrinted).write(to:writer.directory.appendingPathComponent("manifest.json"))
    print("GENERATED",writer.directory.path)
  }
}
