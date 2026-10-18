import SwiftUI
import AVFoundation
import Photos
import UniformTypeIdentifiers

@MainActor final class LiveImport: ObservableObject {
  @Published var message="选择网页导出的 3～10 秒 MP4 视频。"
  @Published var busy=false
  @Published var completed=false
  func importVideo(_ url:URL, removeAfterImport:Bool=false) {
    guard !busy else {return};busy=true;completed=false;message="正在配对实况照片…"
    let access=url.startAccessingSecurityScopedResource()
    Task {
      do {
        let source=AVURLAsset(url:url)
        guard let track=try await source.loadTracks(withMediaType:.video).first else {throw LivePhotoFailure(message:"文件没有视频轨道。")}
        let duration=try await source.load(.duration).seconds
        let rate=Double(try await track.load(.nominalFrameRate))
        let size=try await track.load(.naturalSize),transform=try await track.load(.preferredTransform)
        guard transform.a==1,transform.b==0,transform.c==0,transform.d==1 else {throw LivePhotoFailure(message:"验证版暂只接受网页导出的正向视频。")}
        guard let fps=[24,30,60].first(where:{abs(Double($0)-rate)<0.1}), duration.isFinite, (2.98...10.02).contains(duration), abs(duration.rounded()-duration)<0.02 else {throw LivePhotoFailure(message:"请选择网页导出的 3～10 秒整秒、24/30/60 帧视频。")}
        let frames=Int(duration.rounded())*fps
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString,isDirectory:true)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        defer {try? FileManager.default.removeItem(at:directory)}
        let output=directory.appendingPathComponent("饼饼实况.zip")
        let writer=try await Task.detached(priority:.userInitiated) {
          let writer=try LivePhotoWriter(output:output,fps:fps,totalFrames:frames,width:Int(size.width),height:Int(size.height),coverFrame:frames/2)
          do {
            let reader=try AVAssetReader(asset:source)
            let pixels=AVAssetReaderTrackOutput(track:track,outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
            pixels.alwaysCopiesSampleData=false;reader.add(pixels)
            guard reader.startReading() else {throw reader.error ?? LivePhotoFailure(message:"无法读取视频。")}
            var count=0
            while let sample=pixels.copyNextSampleBuffer() {
              guard let buffer=CMSampleBufferGetImageBuffer(sample) else {throw LivePhotoFailure(message:"视频帧无效。")}
              try writer.appendPixel(buffer);count += 1
            }
            guard reader.status == .completed,count==frames else {throw reader.error ?? LivePhotoFailure(message:"视频帧数不完整，请重新导出。")}
            try writer.finish();return writer
          } catch {writer.cancel();throw error}
        }.value
        message="正在请求保存到相册…"
        try await withCheckedThrowingContinuation { (continuation:CheckedContinuation<Void,Error>) in
          writer.saveToPhotos {result in continuation.resume(with:result.map {_ in ()})}
        }
        completed=true;message="已保存为实况照片。请打开“照片”，长按确认动画。"
      } catch {message=error.localizedDescription}
      if access {url.stopAccessingSecurityScopedResource()};if removeAfterImport {try? FileManager.default.removeItem(at:url)};busy=false
    }
  }
}

struct ImportView:View {
  @ObservedObject var model:LiveImport
  @State private var choosing=false
  var close:(()->Void)?=nil
  var body:some View {
    VStack(spacing:24) {
      Image(systemName:"livephoto").font(.system(size:64)).foregroundStyle(.yellow)
      Text("饼饼实况助手").font(.title.bold())
      Text(model.message).multilineTextAlignment(.center).accessibilityIdentifier("import-status")
      if model.busy {ProgressView()} else {
        Button("选择 MP4 视频"){choosing=true}.buttonStyle(.borderedProminent)
        if let close {Button(model.completed ? "完成" : "关闭",action:close)}
      }
    }.padding(32).frame(maxWidth:.infinity,maxHeight:.infinity)
      .fileImporter(isPresented:$choosing,allowedContentTypes:[.movie,.mpeg4Movie]) {result in
        switch result {case .success(let url):model.importVideo(url);case .failure(let error):model.message=error.localizedDescription}
      }
  }
}
