import Foundation
import CoreGraphics

@main struct ClipboardVectorTests {
    static func pdf(_ draw: (CGContext) -> Void) -> Data {
        let data = NSMutableData(), consumer = CGDataConsumer(data: data)!
        var box = CGRect(x:0,y:0,width:200,height:200)
        let context = CGContext(consumer:consumer,mediaBox:&box,nil)!
        context.beginPDFPage(nil);draw(context);context.endPDFPage();context.closePDF()
        return data as Data
    }
    static func main() throws {
        let fixture = pdf { c in
            c.setFillColor(CGColor(colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!,components:[1,0,0,1])!)
            c.fill(CGRect(x:10,y:20,width:30,height:40))
            c.saveGState();c.translateBy(x:70,y:40);c.scaleBy(x:2,y:2)
            c.setStrokeColor(CGColor(gray:0,alpha:1));c.setLineWidth(2)
            c.strokeEllipse(in:CGRect(x:0,y:0,width:15,height:20));c.restoreGState()
            c.addEllipse(in:CGRect(x:40,y:110,width:50,height:50))
            c.addEllipse(in:CGRect(x:50,y:120,width:30,height:30));c.fillPath(using:.evenOdd)
        }
        let source = try vectorPDFToSVG(fixture)
        precondition(source.components(separatedBy:"<path ").count == 4)
        precondition(source.contains("#ff0000"))
        precondition(source.contains("evenodd"))
        precondition(source.contains("10.00000 20.00000"))
        try fixture.write(to:URL(fileURLWithPath:"/private/tmp/clipboard-vector-fixture.pdf"))
        try source.write(to:URL(fileURLWithPath:"/private/tmp/clipboard-vector-fixture.svg"),atomically:true,encoding:.utf8)
        let raster = pdf { c in
            let bitmap = CGContext(data:nil,width:2,height:2,bitsPerComponent:8,bytesPerRow:8,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
            bitmap.setFillColor(CGColor(gray:0,alpha:1));bitmap.fill(CGRect(x:0,y:0,width:2,height:2))
            c.draw(bitmap.makeImage()!,in:CGRect(x:0,y:0,width:20,height:20))
        }
        do { _ = try vectorPDFToSVG(raster);fatalError("Raster PDF was accepted") } catch is ClipboardVectorError {}
        let clipped = pdf { c in
            c.clip(to:CGRect(x:0,y:0,width:10,height:10));c.fill(CGRect(x:0,y:0,width:50,height:50))
        }
        do { _ = try vectorPDFToSVG(clipped);fatalError("Clipped artwork was accepted without clipping") } catch is ClipboardVectorError {}
        print("Clipboard PDF tests passed: colors, curves, holes, transforms, stroke outlines, raster and clipping rejection")
    }
}
