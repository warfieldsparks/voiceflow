# Building

This document covers local development builds, Windows packaging, and the native helper used for `Ctrl+Win`.

## Prerequisites

Required:

- Node.js 18+
- npm

Recommended:

- Windows for runtime testing
- Wine if packaging Windows installers from Linux
- `x86_64-w64-mingw32-gcc` on Linux if you need to rebuild the `Ctrl+Win` helper

## Scripts

```bash
npm install
npm run dev
npm test
npm run build
npm run package
```

Current script meanings:

- `npm run dev`: Vite renderer dev server plus Electron main process
- `npm run build:native`: rebuilds the native `Ctrl+Win` helper when needed
- `npm run build`: native helper + renderer + main + preload
- `npm run package`: full build plus `electron-builder`

## Build Output

`npm run build` produces:

```text
dist/
  main/
    main/
    preload/
  renderer/
```

It also ensures the Windows helper binary exists at:

```text
resources/bin/win32/voiceflow-ctrl-win-helper.exe
```

## Native `Ctrl+Win` Helper

The helper exists because `Ctrl+Win` needs a real Windows-level interception path.

Source:

```text
native/windows/ctrl_win_hotkey_helper.c
```

Build script:

```text
scripts/build-ctrl-win-helper.mjs
```

Behavior:

- Linux: prefers `x86_64-w64-mingw32-gcc`
- Windows: prefers `gcc` or `clang`
- skips rebuild if the binary is newer than the source
- fails only when no compiler exists and no binary is already available

## Packaging Windows Installers

Standard packaging:

```bash
npm run package
```

Explicit Windows-only packaging:

```bash
npx electron-builder --win
```

Cross-building unsigned Windows installers from Linux:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win nsis -c.win.signAndEditExecutable=false
```

That is the recipe used for the current public release.

## Packaging Notes

Important `electron-builder.yml` details:

- `asar: true`
- `asarUnpack: node_modules/uiohook-napi/**/*`
- `extraResources: resources/bin -> bin`
- non-Windows native binaries are excluded from packaging
- target is NSIS

## Release Artifact

The main release artifact is:

```text
release/VoiceFlow Setup 1.0.0.exe
```

The unpacked Windows app is also produced under:

```text
release/win-unpacked/
```

## Known Build Constraints

### Do Not Remove `@jimp`-related transitive dependencies

`@nut-tree-fork/nut-js` still expects supporting image-processing dependencies to load correctly even though VoiceFlow mainly uses keyboard automation.

### Do Not Reintroduce Strict Config Auto-Clearing

The old approach cleared user settings too aggressively and could wipe the stored API key. Keep the current defaults-plus-migration approach unless you are prepared to write a safe migration layer first.

### Do Not Drop `extraResources` For `resources/bin`

If the native helper is not packaged, `Ctrl+Win` will fall back to lower-level suppression logic and Windows Start-menu behavior may regress.

### Do Not Remove `uiohook-napi` From `asarUnpack`

The native module must remain unpacked to load correctly in packaged builds.

## Build Verification Checklist

Before pushing a release:

1. `npm test`
2. `npm run build`
3. package the NSIS installer
4. confirm `release/win-unpacked/resources/bin/win32/voiceflow-ctrl-win-helper.exe` exists
5. verify the installer size is realistic, not a stub
6. verify the app launches on Windows
7. test `Alt+Z`, `Ctrl+Win`, logging, and `Turn Off VoiceFlow`
