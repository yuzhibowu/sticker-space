import AppKit
import CoreGraphics

struct ClipboardVectorError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Reads only after a user-triggered paste request; never observes clipboard changes.
func readClipboardVector() throws -> [String: String] {
    let board = NSPasteboard.general
    for type in board.types ?? [] where type.rawValue.lowercased().contains("svg") {
        if let bytes = board.data(forType: type), bytes.count <= 1_048_576,
           let svg = String(data: bytes, encoding: .utf8), svg.contains("<svg") {
            return ["source": svg, "name": "剪贴板矢量图.svg"]
        }
    }
    if let text = board.string(forType: .string), text.count <= 1_048_576, text.contains("<svg") {
        return ["source": text, "name": "剪贴板矢量图.svg"]
    }
    if let pdf = board.data(forType: .pdf) {
        return ["source": try vectorPDFToSVG(pdf), "name": "剪贴板矢量图.svg"]
    }
    throw ClipboardVectorError(message: "这个应用没有在剪贴板提供 SVG 或矢量 PDF，只有图片或苹果内部对象格式。请从源应用复制 SVG，或导出矢量 PDF 后拖入。")
}

private struct VectorPDFState {
    var transform = CGAffineTransform.identity
    var fill = "#000000", stroke = "#000000"
    var fillSpace = CGColorSpaceCreateDeviceRGB(), strokeSpace = CGColorSpaceCreateDeviceRGB()
    var width: CGFloat = 1
    var cap = CGLineCap.butt, join = CGLineJoin.miter
    var miter: CGFloat = 10
    var clip: CGRect?
}

private final class VectorPDFScanner {
    var state = VectorPDFState(), stack: [VectorPDFState] = []
    var path = CGMutablePath(), paths: [String] = []
    var failure: String?, depth = 0, segments = 0
    func numbers(_ scanner: CGPDFScannerRef, _ count: Int) -> [CGFloat]? {
        var values = [CGFloat](repeating: 0, count: count)
        for index in (0..<count).reversed() {
            guard CGPDFScannerPopNumber(scanner, &values[index]), values[index].isFinite else { failure = "PDF 坐标无效。"; return nil }
        }
        return values
    }
    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: y).applying(state.transform) }
    func color(_ values: [CGFloat]) -> String {
        let rgb: [CGFloat]
        if values.count == 1 { rgb = Array(repeating: values[0], count: 3) }
        else if values.count == 4 { rgb = values.prefix(3).map { (1-$0)*(1-values[3]) } }
        else { rgb = values }
        return "#" + rgb.map { String(format: "%02x", Int((max(0, min(1, $0))*255).rounded())) }.joined()
    }
    func emit(_ geometry: CGPath, _ fill: String, _ evenOdd: Bool = false) {
        guard failure == nil, !geometry.isEmpty else { return }
        if let clip = state.clip, !clip.insetBy(dx: -0.001, dy: -0.001).contains(geometry.boundingBoxOfPath) {
            failure = "这张 PDF 含有裁切图形，请在源应用中展开裁切后再复制。"; return
        }
        var commands: [String] = []
        func p(_ point: CGPoint) -> String { String(format: "%.5f %.5f", Double(point.x), Double(point.y)) }
        geometry.applyWithBlock { entry in
            let element = entry.pointee
            switch element.type {
            case .moveToPoint: commands.append("M"+p(element.points[0]))
            case .addLineToPoint: commands.append("L"+p(element.points[0]))
            case .addQuadCurveToPoint: commands.append("Q"+p(element.points[0])+" "+p(element.points[1]))
            case .addCurveToPoint: commands.append("C"+p(element.points[0])+" "+p(element.points[1])+" "+p(element.points[2]))
            case .closeSubpath: commands.append("Z")
            @unknown default: self.failure = "PDF 轮廓不受支持。"
            }
        }
        segments += commands.count
        guard paths.count < 100, segments < 20_000 else { failure = "矢量轮廓过于复杂，请简化后复制。"; return }
        paths.append("<path fill=\"\(fill)\" fill-rule=\"\(evenOdd ? "evenodd" : "nonzero")\" d=\"\(commands.joined(separator: " "))\"/>")
    }
    func paint(fill: Bool, stroke: Bool, evenOdd: Bool = false) {
        if fill { emit(path, state.fill, evenOdd) }
        if stroke {
            let sx = hypot(state.transform.a, state.transform.b), sy = hypot(state.transform.c, state.transform.d)
            guard abs(sx-sy) < 0.001 else { failure = "这张 PDF 的描边经过不等比缩放，请将描边转轮廓后复制。"; return }
            emit(path.copy(strokingWithWidth: state.width*sx, lineCap: state.cap, lineJoin: state.join, miterLimit: state.miter), state.stroke)
        }
        path = CGMutablePath()
    }
    func handle(_ op: String, _ scanner: CGPDFScannerRef) {
        guard failure == nil else { return }
        switch op {
        case "q": stack.append(state)
        case "Q": if let saved = stack.popLast() { state = saved } else { failure = "PDF 图形状态无效。" }
        case "cm": if let n = numbers(scanner, 6) { state.transform = CGAffineTransform(a:n[0],b:n[1],c:n[2],d:n[3],tx:n[4],ty:n[5]).concatenating(state.transform) }
        case "m": if let n = numbers(scanner, 2) { path.move(to:point(n[0],n[1])) }
        case "l": if let n = numbers(scanner, 2) { path.addLine(to:point(n[0],n[1])) }
        case "c": if let n = numbers(scanner, 6) { path.addCurve(to:point(n[4],n[5]),control1:point(n[0],n[1]),control2:point(n[2],n[3])) }
        case "v": if let n = numbers(scanner, 4) { path.addCurve(to:point(n[2],n[3]),control1:path.currentPoint,control2:point(n[0],n[1])) }
        case "y": if let n = numbers(scanner, 4) { path.addCurve(to:point(n[2],n[3]),control1:point(n[0],n[1]),control2:point(n[2],n[3])) }
        case "h": path.closeSubpath()
        case "re": if let n = numbers(scanner, 4) { path.addRect(CGRect(x:n[0],y:n[1],width:n[2],height:n[3]),transform:state.transform) }
        case "f", "F": paint(fill:true,stroke:false)
        case "f*": paint(fill:true,stroke:false,evenOdd:true)
        case "S": paint(fill:false,stroke:true)
        case "s": path.closeSubpath();paint(fill:false,stroke:true)
        case "B", "B*", "b", "b*": if op.hasPrefix("b") { path.closeSubpath() };paint(fill:true,stroke:true,evenOdd:op.hasSuffix("*"))
        case "n": path = CGMutablePath()
        case "W", "W*":
            var rectangle = CGRect.zero
            guard path.isRect(&rectangle) else { failure = "这张 PDF 含有复杂裁切，请展开裁切后复制。"; return }
            state.clip = state.clip?.intersection(rectangle) ?? rectangle
        case "rg", "RG", "g", "G", "k", "K":
            if let n = numbers(scanner, op.lowercased()=="g" ? 1 : op.lowercased()=="k" ? 4 : 3) {
                if op == op.lowercased() { state.fill = color(n) } else { state.stroke = color(n) }
            }
        case "w": if let n = numbers(scanner,1) { state.width = n[0] }
        case "J": if let n = numbers(scanner,1) { state.cap = CGLineCap(rawValue:Int32(n[0])) ?? .butt }
        case "j": if let n = numbers(scanner,1) { state.join = CGLineJoin(rawValue:Int32(n[0])) ?? .miter }
        case "M": if let n = numbers(scanner,1) { state.miter = n[0] }
        case "gs":
            var name: UnsafePointer<CChar>?
            guard CGPDFScannerPopName(scanner,&name), let name,
                  let resource = CGPDFContentStreamGetResource(CGPDFScannerGetContentStream(scanner),"ExtGState",name) else { failure = "PDF 图形状态缺失。";return }
            var dict: CGPDFDictionaryRef?
            guard CGPDFObjectGetValue(resource,.dictionary,&dict), let dict else { return }
            for key in ["ca","CA"] { var alpha: CGPDFReal = 1;if CGPDFDictionaryGetNumber(dict,key,&alpha), alpha < 0.999 { failure = "带半透明的矢量暂不支持，请使用实色轮廓。" } }
            var mask: CGPDFDictionaryRef?
            if CGPDFDictionaryGetDictionary(dict,"SMask",&mask) { failure = "带蒙版的矢量暂不支持。" }
        case "Do":
            var name: UnsafePointer<CChar>?
            let parent = CGPDFScannerGetContentStream(scanner)
            guard CGPDFScannerPopName(scanner,&name), let name,let object = CGPDFContentStreamGetResource(parent,"XObject",name) else { failure = "PDF 图形资源缺失。";return }
            var stream: CGPDFStreamRef?
            guard CGPDFObjectGetValue(object,.stream,&stream), let stream else { failure = "PDF 图形资源无效。";return }
            guard let dict = CGPDFStreamGetDictionary(stream) else { failure = "PDF 图形资源无效。";return }; var subtype: UnsafePointer<CChar>?
            guard CGPDFDictionaryGetName(dict,"Subtype",&subtype),let subtype,String(cString:subtype)=="Form",depth < 8 else { failure = "剪贴板 PDF 含有图片或过于复杂的对象，无法作为纯矢量导入。";return }
            let saved = state, savedPath = path, savedStack = stack
            var matrix: CGPDFArrayRef?
            if CGPDFDictionaryGetArray(dict,"Matrix",&matrix),let matrix,CGPDFArrayGetCount(matrix)==6 {
                var n = [CGFloat](repeating:0,count:6)
                for i in 0..<6 { if !CGPDFArrayGetNumber(matrix,i,&n[i]) { failure = "PDF 变换无效。";return } }
                state.transform = CGAffineTransform(a:n[0],b:n[1],c:n[2],d:n[3],tx:n[4],ty:n[5]).concatenating(state.transform)
            }
            path = CGMutablePath();stack = [];depth += 1
            var resources: CGPDFDictionaryRef?
            CGPDFDictionaryGetDictionary(dict,"Resources",&resources)
            scan(CGPDFContentStreamCreateWithStream(stream,resources ?? dict,parent))
            depth -= 1;state = saved;path = savedPath;stack = savedStack
        case "d":
            _ = numbers(scanner,1);var array: CGPDFArrayRef?
            if !CGPDFScannerPopArray(scanner,&array) || array.map({CGPDFArrayGetCount($0) > 0}) == true { failure = "请将虚线转为轮廓后复制。" }
        case "cs", "CS":
            var name: UnsafePointer<CChar>?
            guard CGPDFScannerPopName(scanner,&name),let name else { failure = "PDF 色彩空间无效。";return }
            let label = String(cString:name);var space: CGColorSpace?
            if label == "DeviceRGB" { space = CGColorSpaceCreateDeviceRGB() }
            else if label == "DeviceGray" { space = CGColorSpaceCreateDeviceGray() }
            else if label == "DeviceCMYK" { space = CGColorSpaceCreateDeviceCMYK() }
            else if let resource = CGPDFContentStreamGetResource(CGPDFScannerGetContentStream(scanner),"ColorSpace",name) {
                var array: CGPDFArrayRef?
                if CGPDFObjectGetValue(resource,.array,&array),let array,CGPDFArrayGetCount(array) >= 2 {
                    var label: UnsafePointer<CChar>?,stream: CGPDFStreamRef?;var format = CGPDFDataFormat.raw
                    if CGPDFArrayGetName(array,0,&label),let label,String(cString:label) == "ICCBased",CGPDFArrayGetStream(array,1,&stream),let stream,let data = CGPDFStreamCopyData(stream,&format) { space = CGColorSpace(iccData:data) }
                }
            }
            guard let space else { failure = "PDF 使用了暂不支持的色彩空间。";return }
            if op == "cs" { state.fillSpace = space } else { state.strokeSpace = space }
        case "sc", "SC", "scn", "SCN":
            let space = op == op.lowercased() ? state.fillSpace : state.strokeSpace
            if let values = numbers(scanner,space.numberOfComponents),let rgb = CGColor(colorSpace:space,components:values+[1])?.converted(to:CGColorSpace(name:CGColorSpace.sRGB)!,intent:.defaultIntent,options:nil)?.components {
                if op == op.lowercased() { state.fill = color(Array(rgb.prefix(3))) } else { state.stroke = color(Array(rgb.prefix(3))) }
            } else { failure = "PDF 颜色无效。" }
        case "sh", "BI", "Tj", "TJ", "'", "\"": failure = "这个矢量包含暂不支持的虚线、渐变、图片、文字或色彩空间，请在源应用中转换为实色轮廓。"
        default: break
        }
    }
    func scan(_ content: CGPDFContentStreamRef) {
        guard let table = CGPDFOperatorTableCreate() else { failure = "无法读取 PDF。";return }
        CGPDFOperatorTableSetCallback(table,"q") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("q",scanner) }
        CGPDFOperatorTableSetCallback(table,"Q") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("Q",scanner) }
        CGPDFOperatorTableSetCallback(table,"cm") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("cm",scanner) }
        CGPDFOperatorTableSetCallback(table,"m") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("m",scanner) }
        CGPDFOperatorTableSetCallback(table,"l") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("l",scanner) }
        CGPDFOperatorTableSetCallback(table,"c") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("c",scanner) }
        CGPDFOperatorTableSetCallback(table,"v") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("v",scanner) }
        CGPDFOperatorTableSetCallback(table,"y") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("y",scanner) }
        CGPDFOperatorTableSetCallback(table,"h") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("h",scanner) }
        CGPDFOperatorTableSetCallback(table,"re") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("re",scanner) }
        CGPDFOperatorTableSetCallback(table,"f") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("f",scanner) }
        CGPDFOperatorTableSetCallback(table,"F") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("F",scanner) }
        CGPDFOperatorTableSetCallback(table,"f*") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("f*",scanner) }
        CGPDFOperatorTableSetCallback(table,"S") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("S",scanner) }
        CGPDFOperatorTableSetCallback(table,"s") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("s",scanner) }
        CGPDFOperatorTableSetCallback(table,"B") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("B",scanner) }
        CGPDFOperatorTableSetCallback(table,"B*") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("B*",scanner) }
        CGPDFOperatorTableSetCallback(table,"b") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("b",scanner) }
        CGPDFOperatorTableSetCallback(table,"b*") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("b*",scanner) }
        CGPDFOperatorTableSetCallback(table,"n") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("n",scanner) }
        CGPDFOperatorTableSetCallback(table,"W") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("W",scanner) }
        CGPDFOperatorTableSetCallback(table,"W*") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("W*",scanner) }
        CGPDFOperatorTableSetCallback(table,"rg") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("rg",scanner) }
        CGPDFOperatorTableSetCallback(table,"RG") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("RG",scanner) }
        CGPDFOperatorTableSetCallback(table,"g") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("g",scanner) }
        CGPDFOperatorTableSetCallback(table,"G") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("G",scanner) }
        CGPDFOperatorTableSetCallback(table,"k") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("k",scanner) }
        CGPDFOperatorTableSetCallback(table,"K") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("K",scanner) }
        CGPDFOperatorTableSetCallback(table,"w") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("w",scanner) }
        CGPDFOperatorTableSetCallback(table,"J") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("J",scanner) }
        CGPDFOperatorTableSetCallback(table,"j") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("j",scanner) }
        CGPDFOperatorTableSetCallback(table,"M") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("M",scanner) }
        CGPDFOperatorTableSetCallback(table,"gs") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("gs",scanner) }
        CGPDFOperatorTableSetCallback(table,"Do") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("Do",scanner) }
        CGPDFOperatorTableSetCallback(table,"d") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("d",scanner) }
        CGPDFOperatorTableSetCallback(table,"sh") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("sh",scanner) }
        CGPDFOperatorTableSetCallback(table,"BI") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("BI",scanner) }
        CGPDFOperatorTableSetCallback(table,"Tj") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("Tj",scanner) }
        CGPDFOperatorTableSetCallback(table,"TJ") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("TJ",scanner) }
        CGPDFOperatorTableSetCallback(table,"'") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("'",scanner) }
        CGPDFOperatorTableSetCallback(table,"\"") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("\"",scanner) }
        CGPDFOperatorTableSetCallback(table,"cs") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("cs",scanner) }
        CGPDFOperatorTableSetCallback(table,"CS") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("CS",scanner) }
        CGPDFOperatorTableSetCallback(table,"sc") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("sc",scanner) }
        CGPDFOperatorTableSetCallback(table,"SC") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("SC",scanner) }
        CGPDFOperatorTableSetCallback(table,"scn") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("scn",scanner) }
        CGPDFOperatorTableSetCallback(table,"SCN") { scanner,info in guard let info else { return };Unmanaged<VectorPDFScanner>.fromOpaque(info).takeUnretainedValue().handle("SCN",scanner) }
        let scanner = CGPDFScannerCreate(content,table,Unmanaged.passUnretained(self).toOpaque())
        if !CGPDFScannerScan(scanner) { failure = "PDF 轮廓读取失败。" }
    }
}

func vectorPDFToSVG(_ data: Data) throws -> String {
    guard data.count <= 8_388_608, let provider = CGDataProvider(data:data as CFData),
          let document = CGPDFDocument(provider),document.numberOfPages == 1,let page = document.page(at:1) else {
        throw ClipboardVectorError(message:"请复制单页矢量 PDF，大小不超过 8 MB。")
    }
    let parser = VectorPDFScanner();parser.scan(CGPDFContentStreamCreateWithPage(page))
    if let failure = parser.failure { throw ClipboardVectorError(message:failure) }
    guard !parser.paths.isEmpty else { throw ClipboardVectorError(message:"剪贴板 PDF 没有可导入的矢量轮廓。") }
    let source = "<svg xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"scale(1,-1)\">"+parser.paths.joined()+"</g></svg>"
    guard source.utf8.count <= 1_048_576 else { throw ClipboardVectorError(message:"SVG 轮廓过于复杂，请简化后复制。") }
    return source
}
