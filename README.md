# FilmCraft for Android

**FilmCraft, made Android-compatible.** Edit video, trim clips, apply effects, and work with
color, sound, titles and captions on your phone or tablet.

This is an **unofficial Android fork** of [FilmCraft](https://github.com/storytold/filmcraft)
by the ArtCraft Team. It bundles the Rust editor as WebAssembly inside a local Android WebView,
with Android file import/export and touch-adapted controls. It is not affiliated with or endorsed
by upstream.

**FilmCraft v0.18.0 · Android 0.1.1 alpha · Android 10+**

Release names use **0.18.0-android.0.1.1-alpha**: the first part is the upstream FilmCraft version;
the suffix identifies this fork's Android alpha version.

## Download and install

**[Android release and APK download](https://github.com/itsnold/filmcraft/releases/tag/v0.18.0-android.0.1.1-alpha)**

[Direct APK](https://github.com/itsnold/filmcraft/releases/download/v0.18.0-android.0.1.1-alpha/FilmCraft-0.18.0-android.0.1.1-alpha.apk)
· [SHA256SUMS.txt](https://github.com/itsnold/filmcraft/releases/download/v0.18.0-android.0.1.1-alpha/SHA256SUMS.txt)

1. Open the release above and download **`FilmCraft-0.18.0-android.0.1.1-alpha.apk`** from **Assets**.
2. Allow installation from your browser or file manager when Android asks, then install the APK.
3. Open **FilmCraft**. The editor is bundled in the APK; normal editing does not require a server
   or an internet connection.

The public APK is a **non-debuggable release build**, signed with this fork's permanent release
key—not an Actions debug/testing APK. This is a **public alpha**, not a claim of production-grade
reliability or support for every Android device. Release availability and validation are recorded
on the release page.

`SHA256SUMS.txt` accompanies the APK. Download only from this repository's release page. No GitHub
Actions ZIP, developer tools, or Play Store subscription is needed to install a published APK.

> **Coming from a testing build? Export your projects AND source media first.** Debug builds use a
> different signing key, so Android may require uninstalling the old app. Uninstalling erases its
> private projects, media and settings. Future public updates use the same release key.

## Android requirements

| Component | Requirement / guidance |
|---|---|
| Android version | **Android 10 / API 29 or newer**. Built with SDK 35 and targets Android 15. |
| Graphics | **OpenGL ES 3.0 / WebGL2** support; the editor uses the adapter's actual texture limits. |
| WebView | A recent **Android System WebView**, with WebAssembly and WebGL2 enabled. Chromium **120+ recommended**; keep your device's WebView provider updated. |
| CPU architecture | The editor is WebAssembly, with no ABI-specific native library bundled. Device compatibility still depends on its WebView and graphics driver. |
| Screen | Automatic phone/tablet presentation, portrait and landscape. A larger screen is more comfortable for specialist panels. |
| RAM / processor | **No measured minimum RAM or chipset requirement yet.** Large media and heavy effects can exhaust memory. |
| Storage | Leave free space for media, caches and temporary exports. Keep external backups. |
| Network | The editor runs locally/offline after installation. Downloads and external Help links may need a connection. |

Start with **short 720p sequences and small media**. Smooth 4K, native MediaCodec encoding,
background export and reliability on every device are **not promised**.

## What you can do

- Edit multi-track sequences, trim and split clips, and work with linked video/audio.
- Use FilmCraft's effects, color, audio, titles and caption panels.
- Browse and search the full editor menu tree, including enabled/disabled action states.
- **Phone tabs:** Preview, Timeline, Media and Effects; More opens Source, Effect Controls,
  Properties, Color, Captions, Graphics, Audio Mixer, History, export progress and other panels.
- **Live Program preview** above/beside Timeline, Properties and Effect Controls when space permits.
  Project and Effects can show a companion Timeline for drag-and-drop. Hide the companion for more
  room; switching to Tablet preserves the original dock.
- **Actions:** split, duplicate, delete, ripple delete and exact one-frame In/Out adjustments
  of the first selected clip and its linked media.
- Swipeable shortcuts: Undo/Redo, play, Save/Open/Import, Razor, Select, Hand, fit, timeline zoom,
  frame stepping, Delete/Escape and latched **Shift / Alt / Ctrl** modifiers.
- **75–200% UI scale** choices and **Auto / Phone / Tablet** override. New tablets start at 175%;
  phones start at 100%; previously chosen scales are preserved.
- Labelled buttons, focus outlines, pressed/disabled states, reduced-motion handling,
  focus-contained modal sheets and Android Back dismissal.
- Native document pickers for import/open and project/video export; no all-files permission.

The shared engine's feature set is broader than the Android device-testing matrix. Some dialogs
and specialist tools retain desktop-oriented layouts; not every upstream feature is Android-validated.

## Touch and stylus basics

| Gesture / control | Action |
|---|---|
| Tap | Select or activate a control. |
| Swipe in Auto mode | Scroll panels and the timeline without accidentally moving clips or keys. |
| Hold, then drag | Edit a clip/key or drag a Project item. |
| Long press without moving | Open the context menu where supported. |
| Pinch / two-finger movement | Zoom the preview or timeline / scroll the current panel. |
| **Trim** | Drag near either end of a clip without holding first. |
| **Box select** | Drag empty Project space, Timeline space or the Effect Controls keyframe lane. |
| Project / Effects / Media / Graphics | Hold a draggable item, effect, preset or template, then drag it to the Timeline when both panels are visible; a quick swipe scrolls. |
| Pen tip / hover | Edit immediately on contact; hover for pointer feedback where supported. **Shift / Alt / Ctrl** also modify pen input. No feature requires a pen. |
| **Options** / pen side button | Options then a pen or finger tap opens a context menu; a reported barrel/right click also works. Moving a pen context gesture cancels the menu. |
| **Scroll** / **Drag** | Force navigation / editing instead of Auto's input-specific behavior. |
| **Done** | Leave a special editing mode. |
| **Back** | Dismiss an overlay/edit first; otherwise show the exit/save choice. |

The Effects catalog applies individual effects and has no multi-effect box-selection model.
Pen controls match [EffectCraft for Android](https://github.com/itsnold/effectcraft/tree/android).
Canvas touch isolation during pen contact is not hardware palm rejection; hover and side buttons
depend on the pen and Android WebView.

See the [complete Android guide](docs/android.md) for gestures, layout overrides, file handling,
UI scale, builds and troubleshooting.

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
- Keep the app open during export. Real-device gesture, import/export, recovery and update
  compatibility testing remain outstanding; a successful build does not prove device compatibility.

## Development and bug reports

- [Build from source](docs/android.md#build): Rust 1.95+, WebAssembly tooling, Java 17,
  Gradle 8.13 and Android SDK 35. The Android project is under `packaging/android/`.
- [Android build workflow](https://github.com/itsnold/filmcraft/actions/workflows/android.yml):
  browser/input regressions, JVM tests, Android lint, APK checks and the shared Rust quality gate.
- [Device acceptance checklist](docs/android.md#device-acceptance-before-a-public-release).
- [Upstream engine/desktop README](README.upstream.md)
- [Upstream v0.18.0 source](https://github.com/storytold/filmcraft/tree/v0.18.0)

Android source lives on **`android`**, not `main`. Include device model, Android/WebView versions,
app version and reproduction steps when requesting help. Do not share private media/projects
without reviewing them. This fork currently has GitHub Issues disabled.

## Licence and credits

Based on **FilmCraft by the ArtCraft Team and contributors**. Android shell, exports and gesture code
are adapted from [EffectCraft for Android](https://github.com/itsnold/effectcraft/tree/android);
this is not an official ArtCraft Android release.

Code is dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.
Copyright and required notices are preserved in [NOTICE](NOTICE). Fonts, icons and other assets
retain their own licences and credits in [ATTRIBUTION.md](ATTRIBUTION.md).
Restricted upstream trademark artwork is not included in this modified version.
