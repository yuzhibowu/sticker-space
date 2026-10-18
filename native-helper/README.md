# Optional macOS export helper

Source only; no installer, signing certificate, icon or FFmpeg executable is included. Install Xcode command-line tools and an appropriately licensed FFmpeg build yourself. The helper searches the standard /opt/homebrew/bin/ffmpeg and /usr/local/bin/ffmpeg locations.

```sh
mkdir -p artifacts/helper-build
swiftc Sources/BingBingExportHelper/*.swift -O -swift-version 5 -module-cache-path /tmp/sticker-space-swift-cache -o artifacts/helper-build/StickerExportHelper
./artifacts/helper-build/StickerExportHelper
```

Run from this directory. Default endpoint is 127.0.0.1:43987; localhost browser origins are allowed. Native Photos operations may require app packaging, usage descriptions and signing. No native runtime validation has been performed for this source distribution. Consult upstream FFmpeg distribution requirements when building an installer.
