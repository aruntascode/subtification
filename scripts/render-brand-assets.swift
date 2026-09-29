import AppKit
import CoreText

// Logo, ikon ve açılış (native splash) görsellerini üretir.
// Kullanım (proje kökünden): swift scripts/render-brand-assets.swift assets/images
//
// Logo yazısı Inter Black (assets/fonts/Inter-Black.ttf), rengi kırık beyaz;
// uygulamadaki SubtificationSplash da aynı fontu ve colors.logoText'i kullanır.
// Kart ölçüleri SubtificationSplash.tsx ile aynıdır (pt): yükseklik 52, yatay
// padding 12, radius 8, 1pt kenarlık, font 34. Değiştirirsen ikisini birlikte güncelle
// ve çıktıdaki splash genişliğini app.json → expo-splash-screen → imageWidth'e yaz.

let outDir = URL(fileURLWithPath: CommandLine.arguments[1])
let fontURL = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
  .appendingPathComponent("../assets/fonts/Inter-Black.ttf").standardizedFileURL
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)

func hex(_ s: String, _ a: CGFloat = 1) -> NSColor {
  let v = Int(s.dropFirst(), radix: 16)!
  return NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255,
                 blue: CGFloat(v & 255) / 255, alpha: a)
}

let logoText = hex("#f4f1ea") // colors.logoText (kırık beyaz)
let darkBg = hex("#0f1113")       // koyu tema surface
let lightBg = hex("#f4f1ea")      // kırık beyaz: açık moddaki ikon zemini (logoText ile aynı)
// Açık tema kartı: primarySolid, kenar primarySolidContainer, gölge primary
let lightCard = (fill: hex("#0b7285"), border: hex("#0e7490"), shadow: hex("#0b7285"), alpha: CGFloat(0.18))
// Koyu tema kartı: primarySolid, kenar primaryFixedDim, gölge primary (turkuaz ışıma)
let darkCard = (fill: hex("#0e7490"), border: hex("#5ddce1"), shadow: hex("#5ddce1"), alpha: CGFloat(0.24))

func font(_ size: CGFloat) -> NSFont { NSFont(name: "Inter-Black", size: size)! }
func advance(_ s: String, _ size: CGFloat) -> CGFloat {
  NSAttributedString(string: s, attributes: [.font: font(size)]).size().width
}

func render(_ name: String, width: Int, height: Int, _ draw: (CGContext) -> Void) {
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                             bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                             colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  draw(NSGraphicsContext.current!.cgContext)
  NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using: .png, properties: [:])!.write(to: outDir.appendingPathComponent(name))
}

/// Metni mürekkep sınırına göre ortalar
func drawText(_ ctx: CGContext, _ str: String, size: CGFloat, color: NSColor, center: CGPoint) {
  let line = CTLineCreateWithAttributedString(
    NSAttributedString(string: str, attributes: [.font: font(size), .foregroundColor: color]))
  ctx.textPosition = .zero // ölçüm önceki çizimin konumundan etkilenmesin
  let ink = CTLineGetImageBounds(line, ctx)
  ctx.textPosition = CGPoint(x: center.x - ink.midX, y: center.y - ink.midY)
  CTLineDraw(line, ctx)
}

typealias CardStyle = (fill: NSColor, border: NSColor, shadow: NSColor, alpha: CGFloat)

/// Splash'teki "Sub." kartı; `k` = splash ölçüsüne (font 34) göre çarpan
func drawCard(_ ctx: CGContext, center: CGPoint, k: CGFloat, style: CardStyle, textColor: NSColor = logoText) {
  let w = max(78, ceil(advance("Sub.", 34)) + 24) * k, h = 52 * k, radius = 8 * k
  let r = CGRect(x: center.x - w / 2, y: center.y - h / 2, width: w, height: h)
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: -8 * k), blur: 18 * k,
                color: style.shadow.withAlphaComponent(style.alpha).cgColor)
  ctx.addPath(CGPath(roundedRect: r, cornerWidth: radius, cornerHeight: radius, transform: nil))
  ctx.setFillColor(style.fill.cgColor)
  ctx.fillPath()
  ctx.restoreGState()
  let inset = 0.5 * k
  ctx.addPath(CGPath(roundedRect: r.insetBy(dx: inset, dy: inset), cornerWidth: radius - inset,
                     cornerHeight: radius - inset, transform: nil))
  ctx.setStrokeColor(style.border.cgColor)
  ctx.setLineWidth(1 * k)
  ctx.strokePath()
  drawText(ctx, "Sub.", size: 34 * k, color: textColor, center: CGPoint(x: r.midX, y: r.midY))
}

let cardWidthPt = max(78, ceil(advance("Sub.", 34)) + 24)

// iOS uygulama ikonu: koyu zemin, ortada ışıyan kart (saydamlık yok)
// iOS uygulama ikonu (saydamlık yok). iOS 18+ telefonun görünümüne göre seçer:
// açık modda kırık beyaz zemin + açık tema kartı, koyu modda koyu zemin + ışıyan kart.
func icon(_ name: String, bg: NSColor, style: CardStyle, textColor: NSColor = logoText) {
  render(name, width: 1024, height: 1024) { ctx in
    ctx.setFillColor(bg.cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
    drawCard(ctx, center: CGPoint(x: 512, y: 512), k: 760 / cardWidthPt, style: style, textColor: textColor)
  }
}
icon("icon.png", bg: lightBg, style: lightCard)
icon("icon-dark.png", bg: darkBg, style: darkCard)
// Renklendirilmiş (tinted) mod: gri tonlu çizilir, iOS kendi rengiyle boyar
icon("icon-tinted.png", bg: hex("#000000"),
     style: (fill: hex("#6b6b6b"), border: hex("#d9d9d9"), shadow: hex("#ffffff"), alpha: 0.15),
     textColor: hex("#ffffff"))

// Android adaptive (tek görünüm): açık moddaki iOS ikonuyla aynı; kart ortadaki güvenli alanda
render("android-icon-foreground.png", width: 512, height: 512) { ctx in
  drawCard(ctx, center: CGPoint(x: 256, y: 256), k: 290 / cardWidthPt, style: lightCard)
}
render("android-icon-background.png", width: 512, height: 512) { ctx in
  ctx.setFillColor(lightBg.cgColor)
  ctx.fill(CGRect(x: 0, y: 0, width: 512, height: 512))
}
render("android-icon-monochrome.png", width: 432, height: 432) { ctx in
  // Android monochrome: sistem renklendirir, beyaz çizilir
  drawText(ctx, "Sub.", size: 95, color: .white, center: CGPoint(x: 216, y: 216))
}
render("favicon.png", width: 48, height: 48) { ctx in
  let r = CGRect(x: 0, y: 0, width: 48, height: 48)
  ctx.addPath(CGPath(roundedRect: r, cornerWidth: 10, cornerHeight: 10, transform: nil))
  ctx.clip()
  ctx.setFillColor(lightBg.cgColor)
  ctx.fill(r)
  drawCard(ctx, center: CGPoint(x: 24, y: 24), k: 40 / cardWidthPt, style: lightCard)
}

// Açılış (native) splash: JS splash'in ilk karesiyle aynı kart, 3x; gölge için kenar boşluğu
let scale: CGFloat = 3, margin: CGFloat = 32
let imgW = cardWidthPt + margin * 2, imgH = 52 + margin * 2
print("kart genişliği (pt):", cardWidthPt, " splash imageWidth (pt):", imgW)
for (name, style) in [("splash-icon.png", lightCard), ("splash-icon-dark.png", darkCard)] {
  render(name, width: Int(imgW * scale), height: Int(imgH * scale)) { ctx in
    ctx.scaleBy(x: scale, y: scale)
    drawCard(ctx, center: CGPoint(x: imgW / 2, y: imgH / 2), k: 1, style: style)
  }
}
