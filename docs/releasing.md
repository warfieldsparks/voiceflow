# Releasing

This is the repo's practical release process.

## Preflight

Before creating a release:

1. make sure the repo is clean enough to understand
2. run tests
3. run a full build
4. package the Windows installer
5. test the installer on Windows if possible

Recommended commands:

```bash
npm test
npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win nsis -c.win.signAndEditExecutable=false
```

## Verify The Packaged App

Check that the unpacked app contains the native helper:

```text
release/win-unpacked/resources/bin/win32/voiceflow-ctrl-win-helper.exe
```

If that file is missing, do not publish the installer.

## Verify The Installer

Expected output:

```text
release/VoiceFlow Setup 1.0.0.exe
```

Sanity checks:

- installer size is realistic, not a tiny stub
- the app launches
- `Ctrl+Win` does not open Start
- `Alt+Z` does not type `z`
- `Turn Off VoiceFlow` exits the process
- logs are written

## GitHub Publish Flow

Create or push the repo:

```bash
git push origin master
```

Create the release:

```bash
gh release create v1.0.0 "release/VoiceFlow Setup 1.0.0.exe" \
  --repo warfieldsparks/voiceflow \
  --title "VoiceFlow 1.0.0" \
  --notes "Windows installer release for VoiceFlow."
```

## Public URLs

Repository:

```text
https://github.com/warfieldsparks/voiceflow
```

Current release page:

```text
https://github.com/warfieldsparks/voiceflow/releases/tag/v1.0.0
```

Direct installer asset:

```text
https://github.com/warfieldsparks/voiceflow/releases/download/v1.0.0/VoiceFlow.Setup.1.0.0.exe
```

## After Publishing

Confirm:

- repo is public
- release is public
- installer downloads without authentication
- README install link points at the release
- docs still describe the current release accurately
