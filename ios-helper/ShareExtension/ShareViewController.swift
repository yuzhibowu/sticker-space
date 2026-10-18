import UIKit
import SwiftUI
import UniformTypeIdentifiers
final class ShareViewController:UIViewController {
  private let model=LiveImport()
  override func viewDidLoad() {
    super.viewDidLoad()
    let child=UIHostingController(rootView:ImportView(model:model,close:{[weak self] in self?.extensionContext?.completeRequest(returningItems:nil)}))
    addChild(child);view.addSubview(child.view);child.view.translatesAutoresizingMaskIntoConstraints=false
    NSLayoutConstraint.activate([child.view.topAnchor.constraint(equalTo:view.topAnchor),child.view.bottomAnchor.constraint(equalTo:view.bottomAnchor),child.view.leadingAnchor.constraint(equalTo:view.leadingAnchor),child.view.trailingAnchor.constraint(equalTo:view.trailingAnchor)])
    child.didMove(toParent:self)
    let providers=(extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap {$0.attachments ?? []}
    guard let provider=providers.first(where:{$0.hasItemConformingToTypeIdentifier(UTType.movie.identifier)}) else {model.message="请分享网页导出的 MP4 视频文件。";return}
    model.message="正在读取分享的视频…"
    provider.loadFileRepresentation(forTypeIdentifier:UTType.movie.identifier) {[weak self] url,error in
      guard let url else {DispatchQueue.main.async {self?.model.message=error?.localizedDescription ?? "无法读取视频。"};return}
      // Provider URLs expire when this callback returns. Copy before dispatching.
      let copy=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString+".mp4")
      do {try FileManager.default.copyItem(at:url,to:copy);DispatchQueue.main.async {if let self {self.model.importVideo(copy,removeAfterImport:true)} else {try? FileManager.default.removeItem(at:copy)}}}
      catch {DispatchQueue.main.async {self?.model.message=error.localizedDescription}}
    }
  }
}
