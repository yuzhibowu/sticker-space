import AppKit
import Foundation
import Network
import Darwin
import VideoToolbox
// 编码器提前失败时，让写管道返回错误，不让 SIGPIPE 退出整个助手。
signal(SIGPIPE, SIG_IGN)

private let port: NWEndpoint.Port = NWEndpoint.Port(rawValue: UInt16(CommandLine.arguments.first(where: { $0.hasPrefix("--port=") })?.split(separator: "=").last ?? "43987") ?? 43987)!
private let pngSignature = Data([137, 80, 78, 71, 13, 10, 26, 10])
private let allowedOrigins = [
  "https://qianduan.vercel.app",
  "https://qianduan-zeta.vercel.app",
  "https://qianduan-bingbingshow.vercel.app",
  "https://png-motion.vercel.app",
  "https://3d-sticker-lab.vercel.app",
  "https://3d-sticker-lab-bingbingshow.vercel.app",
  "http://127.0.0.1:",
  "http://localhost:",
]

private func allowed(_ origin: String?) -> Bool {
  guard let origin, !origin.isEmpty else { return true }
  return allowedOrigins.contains { origin == $0 || ($0.hasSuffix(":") && origin.hasPrefix($0)) }
}

#if arch(arm64)
private let helperArchitecture = "arm64"
#else
private let helperArchitecture = "x86_64"
#endif
private let helperVersion = "0.7.0"
// 运行时探测实际硬件/系统能否编码 Alpha；不能只根据 CPU 或 FFmpeg 帮助宣称支持。
private func alphaEncoderAvailable() -> Bool {
  var session: VTCompressionSession?
  let status = VTCompressionSessionCreate(allocator: nil, width: 64, height: 64, codecType: kCMVideoCodecType_HEVCWithAlpha, encoderSpecification: nil, imageBufferAttributes: nil, compressedDataAllocator: nil, outputCallback: nil, refcon: nil, compressionSessionOut: &session)
  guard status == noErr, let session else { return false }
  defer { VTCompressionSessionInvalidate(session) }
  return VTCompressionSessionPrepareToEncodeFrames(session) == noErr
}
private func ffmpegPath() -> String? {
  let candidates = [
    Bundle.main.path(forResource: "ffmpeg-\(helperArchitecture)", ofType: nil),
    Bundle.main.path(forResource: "ffmpeg", ofType: nil),
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ].compactMap { $0 }
  return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
}

private struct FFmpegCapabilities: Sendable {
  let path: String?
  let prores4444: Bool
  let hevcAlpha: Bool
}

private func ffmpegText(_ executable: String, _ arguments: [String]) -> String {
  let process = Process(); let pipe = Pipe()
  process.executableURL = URL(fileURLWithPath: executable)
  process.arguments = arguments
  process.standardOutput = pipe; process.standardError = pipe
  do { try process.run(); } catch { return "" }
  let data = (try? pipe.fileHandleForReading.readToEnd()) ?? Data()
  process.waitUntilExit()
  return String(data: data, encoding: .utf8) ?? ""
}

private let ffmpegCapabilities: FFmpegCapabilities = {
  guard let path = ffmpegPath() else { return FFmpegCapabilities(path: nil, prores4444: false, hevcAlpha: false) }
  let encoders = ffmpegText(path, ["-hide_banner", "-encoders"])
  let hevcHelp = ffmpegText(path, ["-hide_banner", "-h", "encoder=hevc_videotoolbox"])
  return FFmpegCapabilities(
    path: path,
    prores4444: encoders.contains("prores_ks"),
    hevcAlpha: encoders.contains("hevc_videotoolbox") && hevcHelp.contains("alpha_quality") && hevcHelp.contains("bgra") && alphaEncoderAvailable()
  )
}()

private func u32(_ value: UInt32) -> Data {
  var big = value.bigEndian
  return Data(bytes: &big, count: 4)
}

private func u16(_ value: UInt16) -> Data {
  var big = value.bigEndian
  return Data(bytes: &big, count: 2)
}

private let crcTable: [UInt32] = (0..<256).map { index in
  var value = UInt32(index)
  for _ in 0..<8 { value = value & 1 == 1 ? 0xedb88320 ^ (value >> 1) : value >> 1 }
  return value
}

private func crc32(_ parts: [Data]) -> UInt32 {
  var crc = UInt32.max
  for part in parts { for byte in part { crc = crcTable[Int((crc ^ UInt32(byte)) & 0xff)] ^ (crc >> 8) } }
  return crc ^ UInt32.max
}

private func pngChunk(_ type: String, _ payload: Data) -> Data {
  let name = type.data(using: .ascii)!
  return u32(UInt32(payload.count)) + name + payload + u32(crc32([name, payload]))
}

private struct PngParts {
  let ihdr: Data
  let ancillary: [(String, Data)]
  let imageData: [Data]
}

private func inspectPng(_ data: Data) throws -> PngParts {
  guard data.count >= 8, data.prefix(8) == pngSignature else { throw HelperError.message("帧不是有效 PNG") }
  var ihdr: Data?
  var ancillary: [(String, Data)] = []
  var imageData: [Data] = []
  var reachedImage = false
  var offset = 8
  while offset + 12 <= data.count {
    let length = data[offset..<(offset + 4)].reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
    let end = offset + 12 + Int(length)
    guard end <= data.count else { throw HelperError.message("PNG 数据不完整") }
    let type = String(data: data[(offset + 4)..<(offset + 8)], encoding: .ascii) ?? ""
    let payload = Data(data[(offset + 8)..<(offset + 8 + Int(length))])
    if type == "IHDR" { ihdr = payload }
    else if type == "IDAT" { reachedImage = true; imageData.append(payload) }
    else if type != "IEND" && !reachedImage { ancillary.append((type, payload)) }
    offset = end
  }
  guard let ihdr, !imageData.isEmpty else { throw HelperError.message("PNG 帧缺少图像数据") }
  return PngParts(ihdr: ihdr, ancillary: ancillary, imageData: imageData)
}

private func unpackFrameBatch(_ data: Data) throws -> [Data] {
  var frames: [Data] = []
  var offset = 0
  while offset < data.count {
    guard offset + 4 <= data.count else { throw HelperError.message("批量帧头不完整") }
    let length = data[offset..<(offset + 4)].reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
    offset += 4
    guard length >= 8, offset + Int(length) <= data.count else { throw HelperError.message("批量帧数据不完整") }
    frames.append(Data(data[offset..<(offset + Int(length))]))
    offset += Int(length)
  }
  guard (1...16).contains(frames.count) else { throw HelperError.message("单批帧数超出安全范围") }
  return frames
}

private enum HelperError: Error { case message(String) }

private final class ExportJob: @unchecked Sendable {
  let id: String
  let format: String
  let outputName: String
  let outputURL: URL
  let fps: Int
  let expectedFrames: Int
  var frames = 0
  var sequence: UInt32 = 0
  var width: UInt32 = 0
  var height: UInt32 = 0
  var process: Process?
  var livePhoto: LivePhotoWriter?
  var input: FileHandle?
  var output: FileHandle?
  var finished = false
  var errors: Pipe?
  var touched = Date()
  var photosAssetID: String?
  var savingPhotos = false

  init(id: String, format: String, outputName: String, outputURL: URL, fps: Int, expectedFrames: Int) {
    self.id = id; self.format = format; self.outputName = outputName; self.outputURL = outputURL
    self.fps = fps; self.expectedFrames = expectedFrames
  }

  func append(_ frame: Data) throws {
    touched = Date()
    guard !finished, frames < expectedFrames else { throw HelperError.message("帧数超出预期") }
    if let livePhoto { try livePhoto.append(frame) }
    else if format != "apng" {
      guard frame.count > 24, frame.prefix(8) == pngSignature else { throw HelperError.message("帧不是有效 PNG") }
      do { try input?.write(contentsOf: frame) } catch {
        if process?.isRunning == false {
          let detail = String(data: (try? errors?.fileHandleForReading.readToEnd()) ?? Data(), encoding: .utf8) ?? ""
          throw HelperError.message("本机编码器未能接收帧：\(detail.prefix(500))")
        }
        throw error
      }
    }
    else {
      let parsed = try inspectPng(frame)
      let w = parsed.ihdr.prefix(4).reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
      let h = parsed.ihdr.dropFirst(4).prefix(4).reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
      if frames == 0 {
        width = w; height = h
        try output?.write(contentsOf: pngChunk("IHDR", parsed.ihdr))
        for (type, payload) in parsed.ancillary { try output?.write(contentsOf: pngChunk(type, payload)) }
        try output?.write(contentsOf: pngChunk("acTL", u32(UInt32(expectedFrames)) + u32(0)))
      } else if w != width || h != height { throw HelperError.message("PNG 动图的每帧尺寸必须一致") }
      var control = Data()
      [u32(sequence), u32(w), u32(h), u32(0), u32(0), u16(1), u16(UInt16(fps)), Data([0, 0])].forEach { control.append($0) }
      sequence += 1
      try output?.write(contentsOf: pngChunk("fcTL", control))
      if frames == 0 { for payload in parsed.imageData { try output?.write(contentsOf: pngChunk("IDAT", payload)) } }
      else { for payload in parsed.imageData { try output?.write(contentsOf: pngChunk("fdAT", u32(sequence) + payload)); sequence += 1 } }
    }
    frames += 1
  }

  func finish() throws {
    guard !finished, frames == expectedFrames else { throw HelperError.message("导出帧不完整：\(frames)/\(expectedFrames)") }
    if let livePhoto { try livePhoto.finish(packageURL: outputURL) }
    else if format != "apng" {
      try input?.close()
      process?.waitUntilExit()
      guard process?.terminationStatus == 0 else {
        let detail = String(data: (try? errors?.fileHandleForReading.readToEnd()) ?? Data(), encoding: .utf8) ?? ""
        throw HelperError.message("本机 FFmpeg 编码失败：\(detail.prefix(500))")
      }
    } else {
      try output?.write(contentsOf: pngChunk("IEND", Data()))
      try output?.close()
    }
    finished = true; touched = Date()
  }

  func cancel() {
    livePhoto?.cancel()
    if process?.isRunning == true { process?.terminate() }; try? input?.close(); try? output?.close()
    try? FileManager.default.removeItem(at: outputURL)
  }
}

private struct Request {
  let method: String
  let path: String
  let headers: [String: String]
  let body: Data
  var origin: String? { headers["origin"] }
}

private final class HelperServer: @unchecked Sendable {
  private let queue = DispatchQueue(label: "com.yuzhibowu.sticker-lab.export-helper")
  private var listener: NWListener?
  private var jobs: [String: ExportJob] = [:]

  func start() throws {
    let parameters = NWParameters.tcp
    parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: port)
    let listener = try NWListener(using: parameters)
    listener.newConnectionHandler = { [weak self] in self?.receive($0) }
    listener.start(queue: queue)
    self.listener = listener
  }

  private func receive(_ connection: NWConnection) {
    connection.start(queue: queue)
    read(connection, Data())
  }

  private func read(_ connection: NWConnection, _ accumulated: Data) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 2 * 1024 * 1024) { [weak self] data, _, complete, error in
      guard let self else { return }
      var buffer = accumulated
      if let data { buffer.append(data) }
      if let request = self.parse(buffer) { self.handle(request, connection) }
      else if error != nil || complete || buffer.count > 140 * 1024 * 1024 { connection.cancel() }
      else { self.read(connection, buffer) }
    }
  }

  private func parse(_ data: Data) -> Request? {
    let marker = Data("\r\n\r\n".utf8)
    guard let range = data.range(of: marker), let head = String(data: data[..<range.lowerBound], encoding: .utf8) else { return nil }
    let lines = head.components(separatedBy: "\r\n")
    guard let first = lines.first else { return nil }
    let parts = first.split(separator: " ")
    guard parts.count >= 2 else { return nil }
    var headers: [String: String] = [:]
    for line in lines.dropFirst() {
      let pair = line.split(separator: ":", maxSplits: 1)
      if pair.count == 2 { headers[String(pair[0]).lowercased()] = pair[1].trimmingCharacters(in: .whitespaces) }
    }
    let bodyStart = range.upperBound
    let length = Int(headers["content-length"] ?? "0") ?? 0
    guard length >= 0, length <= 128 * 1024 * 1024, data.count >= bodyStart + length else { return nil }
    return Request(method: String(parts[0]), path: String(parts[1]), headers: headers, body: Data(data[bodyStart..<(bodyStart + length)]))
  }

  private func cors(_ origin: String?) -> [String: String] {
    guard let origin, allowed(origin) else { return [:] }
    return [
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-BingBing-Paste",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    ]
  }

  private func send(_ connection: NWConnection, status: Int = 200, type: String = "application/json; charset=utf-8", headers: [String: String] = [:], body: Data = Data()) {
    let reason = status == 200 ? "OK" : status == 201 ? "Created" : status == 204 ? "No Content" : status == 400 ? "Bad Request" : status == 403 ? "Forbidden" : status == 404 ? "Not Found" : "Server Error"
    var values = headers
    values["Content-Type"] = type; values["Content-Length"] = String(body.count); values["Connection"] = "close"; values["Cache-Control"] = "no-store"
    let header = "HTTP/1.1 \(status) \(reason)\r\n" + values.map { "\($0.key): \($0.value)\r\n" }.joined() + "\r\n"
    connection.send(content: Data(header.utf8) + body, completion: .contentProcessed { _ in connection.cancel() })
  }

  private func sendFile(_ connection: NWConnection, job: ExportJob, headers: [String: String]) throws {
    let attributes = try FileManager.default.attributesOfItem(atPath: job.outputURL.path)
    let size = (attributes[.size] as? NSNumber)?.intValue ?? 0
    let type = job.format == "livephoto" ? "application/zip" : job.format == "apng" ? "image/png" : "video/quicktime"
    var values = headers
    values["Content-Type"] = type
    values["Content-Length"] = String(size)
    values["Content-Disposition"] = "attachment; filename*=UTF-8''\(job.outputName.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? job.outputName)"
    values["Connection"] = "close"
    values["Cache-Control"] = "no-store"
    let header = "HTTP/1.1 200 OK\r\n" + values.map { "\($0.key): \($0.value)\r\n" }.joined() + "\r\n"
    let file = try FileHandle(forReadingFrom: job.outputURL)
    connection.send(content: Data(header.utf8), completion: .contentProcessed { [weak self] error in
      guard error == nil else { try? file.close(); connection.cancel(); return }
      self?.sendNextFileChunk(connection, file: file, job: job)
    })
  }

  private func sendNextFileChunk(_ connection: NWConnection, file: FileHandle, job: ExportJob) {
    do {
      let chunk = try file.read(upToCount: 1024 * 1024) ?? Data()
      if chunk.isEmpty {
        try file.close()
        job.touched = Date()
        connection.cancel()
        return
      }
      connection.send(content: chunk, completion: .contentProcessed { [weak self] error in
        if error == nil { self?.sendNextFileChunk(connection, file: file, job: job) }
        else { try? file.close(); connection.cancel() }
      })
    } catch {
      try? file.close(); connection.cancel()
    }
  }

  private func json(_ value: Any) -> Data { (try? JSONSerialization.data(withJSONObject: value)) ?? Data("{}".utf8) }

  private func handle(_ request: Request, _ connection: NWConnection) {
    let expired = jobs.filter { !$0.value.savingPhotos && Date().timeIntervalSince($0.value.touched) > 600 }.map { $0.key }
    for id in expired { jobs.removeValue(forKey: id)?.cancel() }
    let headers = cors(request.origin)
    guard allowed(request.origin) else { return send(connection, status: 403, headers: headers, body: json(["error": "此网页未获本机助手授权"])) }
    if request.method == "OPTIONS" { return send(connection, status: 204, headers: headers) }
    do {
      if request.method == "GET" && request.path == "/v1/capabilities" {
        return send(connection, headers: headers, body: json([
          "available": true,
          "prores4444": ffmpegCapabilities.prores4444,
          "hevcAlpha": ffmpegCapabilities.hevcAlpha,
          "nativeApng": true,
          "clipboardVector": true,
          "unifiedHelper": true,
          "livePhoto": true,
          "frameBatch": true,
          "highQualityHevc": true,
          "maxFrames": 7200,
          "helperVersion": helperVersion,
          "architecture": helperArchitecture,
          "universal": true
        ]))
      }
      if request.method == "POST" && request.path == "/v1/clipboard/vector" {
        guard let origin = request.origin, allowed(origin), request.headers["x-bingbing-paste"] == "1" else {
          return send(connection,status:403,headers:headers,body:json(["error":"请从网页主动粘贴矢量图。"] ))
        }
        let result = try DispatchQueue.main.sync { try readClipboardVector() }
        return send(connection,headers:headers,body:json(result))
      }
      if request.method == "POST" && request.path == "/v1/vector/pdf" {
        let source = try vectorPDFToSVG(request.body)
        return send(connection,headers:headers,body:json(["source":source,"name":"导入矢量图.svg"]))
      }
      if request.method == "POST" && request.path == "/v1/start" {
        let input = try JSONSerialization.jsonObject(with: request.body) as? [String: Any] ?? [:]
        let requestedFormat = input["format"] as? String ?? "mov"
        guard ["apng","hevc","mov","livephoto"].contains(requestedFormat) else { throw HelperError.message("不支持的导出格式") }
        let format = requestedFormat
        let fps = input["fps"] as? Int ?? 30
        let total = input["totalFrames"] as? Int ?? 0
        let completed = jobs.values.filter { $0.finished && !$0.savingPhotos }.sorted { $0.touched < $1.touched }
        if jobs.count >= 8, let oldest = completed.first { jobs.removeValue(forKey: oldest.id)?.cancel() }
        guard [24, 25, 30, 50, 60].contains(fps), (1...7200).contains(total), jobs.values.filter({ !$0.finished }).count < 4 else { throw HelperError.message("导出参数无效") }
        let id = UUID().uuidString
        let ext = format == "livephoto" ? "zip" : format == "apng" ? "png" : "mov"
        let requested = (input["outputName"] as? String)?.components(separatedBy: "/").last ?? "export.\(ext)"
        let name = requested.lowercased().hasSuffix(".\(ext)") ? requested : "\(requested).\(ext)"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("StickerLab-\(id)-\(name)")
        let job = ExportJob(id: id, format: format, outputName: name, outputURL: url, fps: fps, expectedFrames: total)
        if format == "livephoto" {
          guard let width=input["width"] as? Int, let height=input["height"] as? Int, let cover=input["coverFrame"] as? Int else { throw HelperError.message("缺少实况封面或尺寸参数") }
          do { job.livePhoto=try LivePhotoWriter(output:url,fps:fps,totalFrames:total,width:width,height:height,coverFrame:cover) }
          catch { job.cancel(); try? FileManager.default.removeItem(at:url.deletingPathExtension()); throw error }
        } else if format != "apng" {
          guard let ffmpeg = ffmpegCapabilities.path else { throw HelperError.message("没有找到本机 FFmpeg") }
          if format == "hevc" && !ffmpegCapabilities.hevcAlpha { throw HelperError.message("本机 FFmpeg 不支持 HEVC Alpha") }
          if format == "mov" && !ffmpegCapabilities.prores4444 { throw HelperError.message("本机 FFmpeg 不支持 ProRes 4444") }
          let process = Process(); let pipe = Pipe()
          process.executableURL = URL(fileURLWithPath: ffmpeg)
          // Intel VideoToolbox 不支持 Apple Silicon 的 -q:v 质量模式，采用随尺寸
          // 和帧率增长的高码率；Alpha 始终最高质量。两种架构都保留软件回退。
          let hevcQuality: [String]
          if helperArchitecture == "arm64" { hevcQuality = ["-q:v", "90", "-prio_speed", "0"] }
          else {
            let width = input["width"] as? Int ?? 1920, height = input["height"] as? Int ?? 1080
            let bitrate = Int(max(8_000_000, min(180_000_000, Double(width) * Double(height) * Double(fps) * 0.4)))
            hevcQuality = ["-b:v", String(bitrate), "-prio_speed", "0"]
          }
          process.arguments = format == "hevc"
            ? ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "pipe:0", "-vf", "format=bgra", "-c:v", "hevc_videotoolbox", "-pix_fmt", "bgra", "-alpha_quality", "1", "-allow_sw", "1"] + hevcQuality + ["-tag:v", "hvc1", "-an", url.path]
            : ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "pipe:0", "-c:v", "prores_ks", "-profile:v", "5", "-bits_per_mb", "8000", "-pix_fmt", "yuva444p10le", "-alpha_bits", "16", "-vendor", "apl0", url.path]
          let errors = Pipe(); job.errors = errors
          process.standardInput = pipe; process.standardError = errors; try process.run()
          job.process = process; job.input = pipe.fileHandleForWriting
        } else {
          FileManager.default.createFile(atPath: url.path, contents: pngSignature)
          job.output = try FileHandle(forWritingTo: url); try job.output?.seekToEnd()
        }
        jobs[id] = job
        return send(connection, status: 201, headers: headers, body: json(["id": id, "outputName": name]))
      }
      let pieces = request.path.split(separator: "/").map(String.init)
      if pieces.count == 3, pieces[0] == "v1", let job = jobs[pieces[2]] {
        if request.method == "POST" && pieces[1] == "frame" { try job.append(request.body); return send(connection, headers: headers, body: json(["frame": job.frames])) }
        if request.method == "POST" && pieces[1] == "frames" {
          let frames = try unpackFrameBatch(request.body)
          guard job.frames + frames.count <= job.expectedFrames else { throw HelperError.message("批量帧数超出预期") }
          for frame in frames { try job.append(frame) }
          return send(connection, headers: headers, body: json(["frame": job.frames]))
        }
        if request.method == "POST" && pieces[1] == "finish" { try job.finish(); return send(connection, headers: headers, body: json(["outputName": job.outputName, "downloadUrl": "http://127.0.0.1:\(port.rawValue)/v1/download/\(job.id)"])) }
        if request.method == "POST" && pieces[1] == "cancel" { job.cancel(); jobs.removeValue(forKey: job.id); return send(connection, headers: headers, body: json(["cancelled": true])) }
        if request.method == "GET" && pieces[1] == "download" && job.finished {
          try sendFile(connection, job: job, headers: headers); return
        }
        if request.method == "POST" && pieces[1] == "photos" && job.finished, let livePhoto=job.livePhoto {
          job.touched=Date()
          if let assetID=job.photosAssetID { return send(connection,headers:headers,body:json(["saved":true,"assetID":assetID])) }
          guard !job.savingPhotos else { throw HelperError.message("正在存入照片，请稍候。") }
          job.savingPhotos=true
          livePhoto.saveToPhotos { result in
            self.queue.async {
            job.savingPhotos=false; job.touched=Date()
            switch result {
            case .success(let assetID): job.photosAssetID=assetID; self.send(connection,headers:headers,body:self.json(["saved":true,"assetID":assetID]))
            case .failure(let error): self.send(connection,status:400,headers:headers,body:self.json(["error":error.localizedDescription]))
            }
            }
          }
          return
        }
      }
      if request.method == "POST", pieces.count == 3, pieces[1] == "photos" { return send(connection,status:400,headers:headers,body:json(["error":"此实况的助手临时资源已过期。请重新导出，或将已下载 ZIP 中的 JPG 和 MOV 一起导入 Mac“照片”。"])) }
      send(connection, status: 404, headers: headers, body: json(["error": "未知请求"]))
    } catch {
      let message = (error as? HelperError).map { if case let .message(text) = $0 { return text }; return "导出失败" } ?? error.localizedDescription
      send(connection, status: 500, headers: headers, body: json(["error": message]))
    }
  }
}

@MainActor private final class AppDelegate: NSObject, NSApplicationDelegate {
  private let server = HelperServer()
  private var statusItem: NSStatusItem?
  func applicationDidFinishLaunching(_ notification: Notification) {
    do { try server.start() } catch { NSApp.terminate(nil); return }
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    item.button?.title = "饼饼导出"
    let menu = NSMenu()
    let state = NSMenuItem(title: "饼饼导出助手 \(helperVersion) · \(helperArchitecture)", action: nil, keyEquivalent: "")
    state.isEnabled = false; menu.addItem(state); menu.addItem(.separator())
    let capabilities = NSMenuItem(title: ffmpegCapabilities.hevcAlpha ? "HEVC Alpha / ProRes 4444 可用" : "ProRes 4444 可用 · 此 Mac 无 HEVC Alpha 编码器", action: nil, keyEquivalent: "")
    capabilities.isEnabled = false; menu.addItem(capabilities)
    menu.addItem(NSMenuItem(title: "打开饼饼Sticker", action: #selector(openWebsite), keyEquivalent: ""))
    menu.addItem(NSMenuItem(title: "退出助手", action: #selector(quit), keyEquivalent: "q"))
    item.menu = menu; statusItem = item
  }
  @objc private func openWebsite() { NSWorkspace.shared.open(URL(string:"https://3d-sticker-lab.vercel.app")!) }
  @objc private func quit() { NSApp.terminate(nil) }
}

if CommandLine.arguments.contains("--headless") {
  // 自动化验证只运行本地服务，不启动 AppKit 菜单栏界面。
  let server = HelperServer()
  try server.start()
  RunLoop.main.run()
} else {
  let app = NSApplication.shared
  let delegate = MainActor.assumeIsolated { AppDelegate() }
  app.delegate = delegate
  app.setActivationPolicy(.accessory)
  app.run()
}
