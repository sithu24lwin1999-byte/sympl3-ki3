# KI3 POS Android APK distribution

This project can be distributed outside Play Store by building a signed Android APK and hosting it behind the public download page:

```text
https://sithu24lwin1999-byte.github.io/sympl3-ki3/#/download
```

## Current setup

- Capacitor Android wrapper: `android/`
- Capacitor config: `capacitor.config.ts`
- Package name: `com.ki3.pos`
- APK download path after build/upload: `public/downloads/ki3-pos.apk`

## Local requirements

Install these before building APKs:

- Java JDK 21 or a compatible Android Gradle JDK
- Android Studio
- Android SDK, Android Platform Tools and Android Build Tools

This machine did not have Java installed when the Android wrapper was added, so APK build could not be completed here yet.

## Build commands

```bash
npm ci
npm run mobile:sync
npm run mobile:apk:debug
```

Debug APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For public sharing, use a signed release APK from Android Studio or a secure release signing setup. Never commit keystores, passwords or signing configuration containing secrets.

## Publish the direct download link

After a signed APK is built:

1. Rename the signed APK to `ki3-pos.apk`.
2. Copy it to `public/downloads/ki3-pos.apk`.
3. Commit and deploy the file, or upload it to a private/public release host and adjust the download page if needed.
4. Open the download page. The Android APK button becomes active automatically when the file exists.

Android users may need to allow “Install unknown apps” for their browser before installing an APK downloaded outside Play Store.
