# Building the Android app

The Android app is the same React code wrapped with [Capacitor](https://capacitorjs.com).
It ships with the Agra content pack (`public/packs/agra.json`), so it works on first launch
with no network and no backend. When the backend is reachable it uses Gemini answers and
Sarvam voice; when it is not, the header shows "Server unreachable" and answers come from
the on-device pack.

## Requirements

- Node 22 or newer
- JDK 21 (Android Studio's bundled JBR works)
- Android SDK with platform 36 and build-tools 36 (set `ANDROID_HOME`)

## Point the app at your backend

The API address is fixed at build time. Set it before building, for example:

```bash
echo "VITE_API_BASE_URL=https://your-backend.onrender.com" > .env.production.local
```

Without it the app uses the default in `src/services/api.ts`. The backend must allow the
app's origin in `CORS_ORIGINS` (`https://localhost` and `capacitor://localhost`).

## Refresh the bundled content pack

Run this after editing anything under `data/destinations/agra/`:

```bash
npm run pack:export
```

## Build

```bash
npm run android:debug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

For a signed release APK, create `android/keystore.properties` (git-ignored) pointing at your keystore:

```properties
storeFile=upheritage-release.jks
storePassword=...
keyAlias=upheritage
keyPassword=...
```

```bash
npm run android:release
```

Keep the keystore and its password safe. Every update to an installed app must be signed with the same key.

If Gradle fails with "429 Too Many Requests" from Maven Central, run it again with `--max-workers=1`.

## Install on a phone

Copy the APK to the phone, open it, and allow "Install unknown apps" for your file manager when Android asks.

## Optional: Google Maps key for the 360° walk

The 360° walk shows Google Street View at each stop. It works without a key using Google's
public Street View embed. For Google's official, supported embed, create a free
"Maps Embed API" key in Google Cloud and build with it:

```bash
echo "VITE_GOOGLE_MAPS_EMBED_KEY=your-key" >> .env.production.local
```

Restrict the key to the Maps Embed API. Without internet, each stop falls back to a photo.
