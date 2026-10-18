import Foundation
import AVFoundation
import ImageIO
import UniformTypeIdentifiers
import Photos

struct LivePhotoFailure: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

// Plain SDR Live Photo resources for Photos and social sharing; no wallpaper template.
final class LivePhotoWriter {
  let identifier = UUID().uuidString
  let directory: URL
  let imageURL: URL
  let movieURL: URL
  let coverFrame: Int
  let fps: Int
  let totalFrames: Int
  let width: Int
  let height: Int
  private let writer: AVAssetWriter
  private let input: AVAssetWriterInput
  private let pixels: AVAssetWriterInputPixelBufferAdaptor
  private var count = 0

  init(output: URL, fps: Int, totalFrames: Int, width: Int, height: Int, coverFrame: Int) throws {
    guard [24,30,60].contains(fps), totalFrames % fps == 0, (3...10).contains(totalFrames / fps),
      (0..<totalFrames).contains(coverFrame), (2...4096).contains(width), (2...4096).contains(height), width % 2 == 0, height % 2 == 0 else {
      throw LivePhotoFailure(message: "实况参数无效：时长应为 3～10 秒，封面必须位于视频内。")
    }
    self.fps=fps; self.totalFrames=totalFrames; self.width=width; self.height=height; self.coverFrame=coverFrame
    directory=output.deletingPathExtension()
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let name=output.deletingPathExtension().lastPathComponent
    imageURL=directory.appendingPathComponent(name+".jpg"); movieURL=directory.appendingPathComponent(name+".mov")
    writer=try AVAssetWriter(outputURL: movieURL, fileType: .mov)
    writer.movieTimeScale=6000
    let settings: [String:Any] = [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: max(6_000_000,width*height*fps/5), AVVideoExpectedSourceFrameRateKey: fps, AVVideoMaxKeyFrameIntervalKey: fps],
      AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2, AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2, AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]]
    guard writer.canApply(outputSettings: settings, forMediaType: .video) else { throw LivePhotoFailure(message: "这台 Mac 无法编码实况视频。") }
    input=AVAssetWriterInput(mediaType: .video, outputSettings: settings); input.expectsMediaDataInRealTime=false; input.mediaTimeScale=6000
    pixels=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height, kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true])
    writer.add(input)
    let pairing=AVMutableMetadataItem(); pairing.identifier = .quickTimeMetadataContentIdentifier; pairing.value=identifier as NSString
    writer.metadata=[pairing]
    let spec: [String:Any] = [kCMMetadataFormatDescriptionMetadataSpecificationKey_Identifier as String: "mdta/com.apple.quicktime.still-image-time",
      kCMMetadataFormatDescriptionMetadataSpecificationKey_DataType as String: "com.apple.metadata.datatype.int8"]
    var description: CMFormatDescription?
    guard CMMetadataFormatDescriptionCreateWithMetadataSpecifications(allocator: kCFAllocatorDefault, metadataType: kCMMetadataFormatType_Boxed, metadataSpecifications: [spec] as CFArray, formatDescriptionOut: &description)==noErr,
      let description else { throw LivePhotoFailure(message: "无法创建实况封面时间轨。") }
    let metadataInput=AVAssetWriterInput(mediaType: .metadata, outputSettings: nil, sourceFormatHint: description)
    let metadata=AVAssetWriterInputMetadataAdaptor(assetWriterInput: metadataInput); writer.add(metadataInput)
    guard writer.startWriting() else { throw writer.error ?? LivePhotoFailure(message: "无法启动实况编码。") }
    writer.startSession(atSourceTime: .zero)
    let still=AVMutableMetadataItem(); still.keySpace = .quickTimeMetadata; still.key="com.apple.quicktime.still-image-time" as NSString
    still.value=NSNumber(value: Int8(0)); still.dataType="com.apple.metadata.datatype.int8"
    guard metadata.append(AVTimedMetadataGroup(items: [still], timeRange: CMTimeRange(start: CMTime(value: Int64(coverFrame), timescale: Int32(fps)), duration: CMTime(value: 1,timescale: Int32(fps))))) else {
      throw writer.error ?? LivePhotoFailure(message: "无法写入实况封面时间。")
    }
    metadataInput.markAsFinished()
  }

  func append(_ data: Data) throws {
    guard count<totalFrames, let source=CGImageSourceCreateWithData(data as CFData,nil), let image=CGImageSourceCreateImageAtIndex(source,0,nil), image.width==width, image.height==height,
      let pool=pixels.pixelBufferPool else { throw LivePhotoFailure(message: "实况帧损坏或尺寸不一致。") }
    let deadline=Date().addingTimeInterval(15)
    while !input.isReadyForMoreMediaData {
      guard writer.status == .writing, Date()<deadline else { throw writer.error ?? LivePhotoFailure(message: "实况编码等待超时。") }
      Thread.sleep(forTimeInterval: 0.002)
    }
    var buffer: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(nil,pool,&buffer)==kCVReturnSuccess, let buffer else { throw LivePhotoFailure(message: "无法分配实况视频帧。") }
    CVPixelBufferLockBaseAddress(buffer,[]); defer { CVPixelBufferUnlockBaseAddress(buffer,[]) }
    let info=CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    guard let context=CGContext(data: CVPixelBufferGetBaseAddress(buffer),width:width,height:height,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:info) else { throw LivePhotoFailure(message: "无法绘制实况视频帧。") }
    context.setFillColor(CGColor(gray:1,alpha:1)); context.fill(CGRect(x:0,y:0,width:width,height:height))
    context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
    guard pixels.append(buffer,withPresentationTime:CMTime(value:Int64(count),timescale:Int32(fps))) else { throw writer.error ?? LivePhotoFailure(message: "实况视频帧写入失败。") }
    count += 1
  }

  func finish(packageURL: URL) throws {
    guard count==totalFrames else { throw LivePhotoFailure(message: "实况帧不完整。") }
    writer.endSession(atSourceTime:CMTime(value:Int64(totalFrames),timescale:Int32(fps))); input.markAsFinished()
    let finished=DispatchSemaphore(value:0); writer.finishWriting { finished.signal() }
    guard finished.wait(timeout:.now()+60) == .success, writer.status == .completed else { writer.cancelWriting(); throw writer.error ?? LivePhotoFailure(message:"实况视频编码失败。") }
    // Extract the chosen frame from the encoded movie, so still and motion agree.
    let asset=AVURLAsset(url:movieURL); let generator=AVAssetImageGenerator(asset:asset)
    generator.appliesPreferredTrackTransform=true; generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
    let time=CMTime(value:Int64(coverFrame),timescale:Int32(fps))
    let image=try generator.copyCGImage(at:time,actualTime:nil)
    guard let destination=CGImageDestinationCreateWithURL(imageURL as CFURL,UTType.jpeg.identifier as CFString,1,nil) else { throw LivePhotoFailure(message:"无法保存实况封面。") }
    CGImageDestinationAddImage(destination,image,[kCGImagePropertyMakerAppleDictionary: ["17":identifier],kCGImageDestinationLossyCompressionQuality:0.98,kCGImagePropertyOrientation:1] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw LivePhotoFailure(message:"实况封面写入失败。") }
    let process=Process();process.executableURL=URL(fileURLWithPath:"/usr/bin/ditto");process.arguments=["-c","-k","--keepParent",directory.path,packageURL.path]
    try process.run();process.waitUntilExit();guard process.terminationStatus==0 else {throw LivePhotoFailure(message:"实况打包失败。")}
  }

  func cancel() { if writer.status == .writing {writer.cancelWriting()}; try? FileManager.default.removeItem(at:directory) }

  func saveToPhotos(completion: @escaping (Result<String,Error>)->Void) {
    PHPhotoLibrary.requestAuthorization(for:.addOnly) { status in
      guard status == .authorized else { completion(.failure(LivePhotoFailure(message:"请允许导出助手向“照片”添加实况，或将 ZIP 中的 JPG 和 MOV 一起手动导入。")));return }
      var assetID=""
      PHPhotoLibrary.shared().performChanges({
        let request=PHAssetCreationRequest.forAsset()
        request.addResource(with:.photo,fileURL:self.imageURL,options:nil)
        request.addResource(with:.pairedVideo,fileURL:self.movieURL,options:nil)
        assetID=request.placeholderForCreatedAsset?.localIdentifier ?? ""
      }) {success,error in
        if success {completion(.success(assetID))} else {completion(.failure(error ?? LivePhotoFailure(message:"存入照片失败。")))}
      }
    }
  }
}
