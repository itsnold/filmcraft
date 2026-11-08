# FCDroid Android guide

## Source and architecture

FilmCraft **v0.18.0**, commit `015d5b3ea37e1202a529e6245d3cc021c8c16ffd`, compiled to WASM.
A Java Activity supplies WebView, document pickers, insets/IME resizing and bounded exports.
Shell/gestures derive from ECDroid commit `1e79d81ae7a329900c336ed82d4c6c7ade5129d7`
(MIT OR Apache-2.0), adapted for FilmCraft clips/tracks. This is an owner-approved fork exception
to native-only/shared-CI policies. Desktop/web entry points remain. No proprietary editor code is used.

## Touch

Tap selects. In Auto, swipe rows to scroll; hold for 500 ms then move the same finger to edit.
Release a stationary hold for context options. Pinch zooms; parallel two-finger movement scrolls.
Cancellation, rotation and lost focus release active input. Mouse/pen keep their normal path.
Adding a second finger ends an active drag; it does not undo it.

**Trim** makes dragging either visible clip end immediate. **Box select** starts a rectangle from
empty timeline time space; occupied clip bodies scroll safely. Both select the Selection tool.
**Done**, the active mode button or Back leaves the mode. Shift adds to selection; clear modifiers
after use. The shortcut bar scrolls sideways. **Actions** offers editing and exact one-frame trims,
guarded against a changed selection. **Menu** browses/searches upstream menus.
**More → Export video** opens the export workspace; completed output uses the native picker.

Phone track headers show target/lock controls; specialist controls remain in Tablet/context menus.
Preview is above/beside Timeline, Properties and Effect Controls, omitted in very short windows.
More can hide it. Layout/UI scale are saved locally; phone navigation never replaces the saved dock.
HTML controls have accessible names, focus indicators, pressed/disabled feedback and modal focus
containment. Full TalkBack navigation of the canvas is **not validated**.

## Storage and safety

Media/recovery use upstream OPFS. Save external `.fcproj` files **plus source media**. Export writes
192 KiB chunks to private temporary storage, checks size, then offers Create Document. Limit:
512 MiB/file, four queued native exports. Cancel/failure offers Retry/Discard, never false success.
Pending exports are not preserved across process death.

Back dismisses a sheet, special mode or editor overlay first. **Save session & close** waits for
snapshot and metadata write success, but is not an external backup. Android may interrupt background
snapshot attempts. Package: `io.github.itsnold.fcdroid`, version **0.1.0-alpha**, code **1**.
No storage/media permission is requested. Only the local HTTPS asset origin can access the native
bridge; remote content is blocked. Internet permission supports the WebView stack, not a server.

## Build

Rust **1.95+**, Node **24+**, Java **17**, Gradle **8.13**, SDK **35**, build-tools **35.0.0**.
The WASM binding CLI must exactly match **0.2.129**.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked
node apps/filmcraft-web/tests/touch.mjs
node apps/filmcraft-web/tests/phone.mjs
node apps/filmcraft-web/tests/android-browser.mjs --chrome google-chrome
cargo xtask ci
cargo xtask web
node apps/filmcraft-web/tests/android-browser.mjs --chrome google-chrome --dist target/web/dist
gradle -p packaging/android :app:lintDebug :app:assembleDebug
# packaging/android/app/build/outputs/apk/debug/app-debug.apk
```

Set `ANDROID_HOME` / `ANDROID_SDK_ROOT` or `packaging/android/local.properties`. Pass a custom web
directory with `-PwebDist=/absolute/dist`. Missing WASM fails the build. Launcher resources derive
from the permissively licensed FilmCraft icon. Licences/notices are bundled. No font binaries added.

The Android workflow runs Node/browser tests, standalone JVM export regressions, lint, WASM build
and a real Android-mode browser smoke test before uploading a debug APK/checksum. The separate Rust
quality gate calls the upstream shared workflow. Review **all jobs** before distributing artifacts.
No release-publishing job exists; no permanent signing key is created. Debug keys can change between
runners: back up externally before uninstalling. Artifacts are not permanently signed releases.

## Device acceptance before a public release

- Offline launch, outdated/missing WebView, 4096-texture WebGL adapter.
- Video/audio/still import from local/cloud providers, preview/seek/audio.
- Phone/tablet, portrait/landscape, split screen, keyboard/IME, app switching.
- Real-finger selection, scrolling, hold/drag, both trim ends, box selection, pinch and Undo/Redo.
- TalkBack, switch access, modal focus/dismissal and optional physical keyboard.
- Save/reopen with media, MP4 export, picker cancellation/provider failure and disk-full handling.
- Process-death recovery, external backups and signing/update compatibility.

Browser tests/APK assembly do **not** substitute for these checks. This first port has not completed
the device matrix; do not describe it as production-ready.
