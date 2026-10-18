import SwiftUI
@main struct BingBingLiveApp:App {
  @StateObject private var model=LiveImport()
  var body:some Scene {WindowGroup {ImportView(model:model).onOpenURL {model.importVideo($0)}}}
}
