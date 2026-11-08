# FCDroid — FilmCraft for Android

**Edit video on a phone or tablet without keeping a keyboard and mouse attached.**
An **unofficial Android fork** of [FilmCraft](https://github.com/storytold/filmcraft),
using the Android/touch approach from [ECDroid](https://github.com/itsnold/effectcraft).
Not affiliated with or endorsed by the upstream team or Adobe.

**FilmCraft v0.18.0 · FCDroid 0.1.1-alpha source · Android 10+**

## APK download and installation

**[Android APK builds](https://github.com/itsnold/filmcraft/actions/workflows/android.yml)**

There is **no published, permanently signed FCDroid release yet**. After a successful
`Android APK` workflow run on the **`android` branch**, download its **`fcdroid-android-debug`**
artifact, unzip it, and install `app-debug.apk`. GitHub may require sign-in for artifacts.
Allow installation from your browser/file manager when Android asks. The artifact includes
`SHA256SUMS.txt` for verification.

These are **debug-signed testing APKs**, not production releases. Signing keys may differ between
runners: **export projects and source media before uninstalling or replacing a testing build**.
Uninstalling erases private storage. A successful build is not proof of device compatibility.

The complete editor is bundled in the APK; normal editing runs locally/offline.

## Android requirements

| Component | Requirement / guidance |
|---|---|
| Android | **Android 10 / API 29+**; compile/target SDK 35 |
| Graphics | OpenGL ES 3.0 / WebGL2; uses the adapter's actual texture limits |
| WebView | Recent Android System WebView with WASM; Chromium 120+ recommended |
| CPU | WASM engine; no ABI-specific native library bundled |
| Screen | Automatic phone/tablet presentation, portrait and landscape |
| RAM/storage | No measured minimum; allow space for media, caches and temporary exports |

Start with **short 720p sequences and small media**. Smooth 4K, native MediaCodec encoding,
background export and reliability on every device are **not promised**.

## Touch and phone features

- **Phone tabs:** Preview, Timeline, Media and Effects; More opens Source, Effect Controls,
  Properties, Color, Captions, Graphics, Audio Mixer, History, export progress and other panels.
- **Live Program preview** above/beside Timeline, Properties and Effect Controls when space permits.
  Project and Effects can show a companion Timeline for drag-and-drop. Hide the companion for more
  room; switching to Tablet preserves the original dock.
- **Full menu browser and search**, backed by the real menu tree and enabled states.
- **Auto / Scroll / Drag** modes: quick timeline swipes navigate without moving clips;
  hold a clip for 500 ms then drag to edit; stationary holds offer context menus.
- **Pinch zoom**, two-finger scrolling, ruler scrubbing and enlarged trim/zoom targets.
- **Trim** and **Box select** modes with **Done**; Project panel box selection starts in empty
  space. Hold a Project item or effect and drag it to the Timeline when both panels are visible.
- **Actions:** split, duplicate, delete, ripple delete and exact one-frame In/Out adjustments
  of the first selected clip and its linked media.
- Swipeable shortcuts: Undo/Redo, play, Save/Open/Import, Razor, Select, Hand, fit, timeline zoom,
  frame stepping, Delete/Escape and latched **Shift / Alt / Ctrl** modifiers.
- **75–200% UI scale** choices and **Auto / Phone / Tablet** override. New tablets start at 175%;
  phones start at 100%; previously chosen scales are preserved.
- Labelled buttons, focus outlines, pressed/disabled states, reduced-motion handling,
  focus-contained modal sheets and Android Back dismissal.
- Native document pickers for import/open and project/video export; no all-files permission.

**Accessibility scope:** touch, motor-access and keyboard-free improvements, **not complete TalkBack
support**. The canvas editor and specialist dialogs need assistive-technology/device testing.
Some controls remain small or desktop-oriented.

## Files, privacy and limitations

- Save **`.fcproj` projects AND source media externally**. Private recovery snapshots are best
  effort, not backups. Android can stop the app without a shutdown callback.
- Export uses bounded chunks and Android **Create Document**, with failure/retry handling:
  **512 MiB per file**, up to four pending native exports.
- This is a **Rust/WASM WebView port**, not an NDK/MediaCodec rewrite. Upstream software codecs and
  browser media APIs remain; cooperative rendering/export can block or slow the UI.
- Content loads from a private HTTPS asset origin. Remote subresources/in-WebView navigation are
  blocked; explicit external links open in your browser. No analytics/server is added.
- Keep the app open during export. Device acceptance is required before a public release.

## Development

- [Android guide, build instructions and acceptance checklist](docs/android.md)
- [APK workflow](.github/workflows/android.yml)
- [Upstream engine/desktop README](README.upstream.md)
- [Upstream v0.18.0 source](https://github.com/storytold/filmcraft/tree/v0.18.0)

Android source lives on **`android`**, not `main`. Include device model, Android/WebView versions,
app version and reproduction steps when requesting help. Do not share private media/projects
without reviewing them. This fork currently has GitHub Issues disabled.

## Licence and credits

Based on **FilmCraft by the ArtCraft Team and contributors**. Android shell, exports and gesture code
are adapted from **ECDroid / EffectCraft for Android**; see [NOTICE](NOTICE).
Code: [MIT](LICENSE-MIT) OR [Apache-2.0](LICENSE-APACHE). Fonts/assets retain their licences in
[ATTRIBUTION.md](ATTRIBUTION.md). Restricted upstream trademark artwork is not included.
