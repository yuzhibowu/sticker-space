Audio engine and bundled sound assets from CatsJuice/sticker-forge.
Source: https://github.com/CatsJuice/sticker-forge
License: MIT, copyright (c) 2026 CatsJuice. See LICENSE.
Local modifications: audio-source.ts is an app-local fetch adapter; the audio-source import points to it. Vite imports use ?url instead of ?inline to keep audio in separate files.
