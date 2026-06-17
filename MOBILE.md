# Mobile Setup

This project now uses Capacitor to package the existing React app as a native mobile app.

## Scripts

- `npm run typecheck`
  Runs a full TypeScript pass before a device build.

- `npm run test:app-ready`
  Runs the two fastest release-readiness checks:
  typecheck plus production web build.

- `npm run mobile:prep`
  Runs typecheck, production build, and Capacitor sync so the native projects are ready for device testing.

- `npm run server:dev`
  Starts the realtime challenge server in watch mode on port `3001`.

- `npm run server:start`
  Starts the realtime challenge server once on port `3001`.

- `npm run mobile:copy`
  Builds the web app and copies it into the native projects.

- `npm run mobile:sync`
  Builds the web app and syncs web assets plus Capacitor plugins to iOS and Android.

- `npm run mobile:android`
  Builds, syncs, and opens the Android project in Android Studio.

- `npm run mobile:ios`
  Builds, syncs, and opens the iOS project in Xcode.
  If Xcode does not come to the front, open [App.xcodeproj](/Applications/Desktop/The App/skill-based-gaming-platform/ios/App/App.xcodeproj) manually.

## Native Projects

- Android project: [android](/Applications/Desktop/The App/skill-based-gaming-platform/android)
- iOS project: [ios](/Applications/Desktop/The App/skill-based-gaming-platform/ios)
- Direct iOS Xcode project: [App.xcodeproj](/Applications/Desktop/The App/skill-based-gaming-platform/ios/App/App.xcodeproj)

## App IDs

- Android application ID: `com.cerebrum.skillarena`
- iOS bundle ID: `com.animashaun.cerebrum.skillarena`
- Capacitor app ID: `com.cerebrum.skillarena`

The iOS bundle ID is intentionally different right now because it is the signed ID currently used in Xcode. Do not change it casually before a device test or you may break Apple signing.

## Local Prerequisites

- Install full Xcode, then make it the active developer directory:
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

- Install Android Studio and a Java runtime/JDK so Gradle can run.

- Android SDK is already referenced at:
  `/Users/surft/Library/Android/sdk`

## Realtime Ludo Testing

- The app can run in local preview mode without the server, but live Ludo rooms, invites, and challenge acceptance need the realtime backend running.

- The same backend now also powers beta registration, login, shared usernames, shared balance, and the real invite list used by the Play page.

- Important:
  The packaged mobile app should not rely on `localhost` auto-detection for the shared beta backend.
  For iPhone, Android device, or emulator friend-testing, set both `VITE_API_URL` and `VITE_REALTIME_URL` before `npm run mobile:prep`.

- Set `VITE_API_URL` too when the device cannot reach `localhost` directly.
  Physical phone example:
  `VITE_API_URL=http://YOUR_COMPUTER_LAN_IP:3001`

- Android emulator example:
  `VITE_REALTIME_URL=http://10.0.2.2:3001`

- Physical phone example:
  `VITE_REALTIME_URL=http://YOUR_COMPUTER_LAN_IP:3001`

- Example env file:
  [/.env.mobile.example](/Applications/Desktop/The App/skill-based-gaming-platform/.env.mobile.example)
  Copy its values into your own local env before building the phone app.

- Public beta env file:
  [/.env.production.example](/Applications/Desktop/The App/skill-based-gaming-platform/.env.production.example)
  Use this when the app should talk to a public backend instead of your laptop.

- Current realtime flow covers public or private room creation, invite delivery, challenge acceptance, seat presence, ready states, and server-authoritative Ludo turn syncing for 2-player or 4-player rooms.

- Render deployment blueprint:
  [render.yaml](/Applications/Desktop/The App/skill-based-gaming-platform/render.yaml)
  This sets up the shared beta backend with a persistent disk path for `beta-db.json`.

- Remote beta release steps:
  [BETA_RELEASE.md](/Applications/Desktop/The App/skill-based-gaming-platform/BETA_RELEASE.md)

- Shared beta data is stored locally in:
  [server/data/beta-db.json](/Applications/Desktop/The App/skill-based-gaming-platform/server/data/beta-db.json)
  This now persists registered users, balances, and posted challenges across restarts.

## App Test Checklist

Use this as the quickest smoke pass before sharing a build:

1. Run `npm run mobile:prep`.
2. If you want live invites or live challenge acceptance across devices, run `npm run server:dev`.
3. Open the app and confirm:
   - auth loads and lands in the main app
   - bottom navigation switches between `Home`, `Play`, `Ranks`, `Wallet`, and `Profile`
   - `Play` page opens and `Back to arena` returns to the dashboard
4. In `Play`, test the WordForge and Scrabble flow:
   - create a public challenge
   - create a private challenge
   - add an opponent by username
   - add an email referral
   - tap `Post & share`
   - confirm the creator sees `Waiting for player` until a real opponent accepts
5. Test solo and friends quick-start flows:
   - `Grandline Chess` solo
   - `Whot` solo
   - `Ludo Rush` 2-player room
   - `Ludo Rush` 4-player room
6. Confirm `Wallet` still accepts a mock deposit and the balance updates.
7. Confirm `Profile` opens without trapping the user.
8. On a second device, create a second beta account and confirm:
   - login works
   - the first account can be found by username
   - the shared balance persists after reopening the app

## Current Known Limits

- Live challenge sync needs the realtime server. Without it, the app falls back to local preview data.
- Ludo live match syncing now works through the realtime server, but active matches are still held in server memory and can reset if the backend restarts during a game.
- WordForge and Scrabble currently play as 2-player boards even if you attach multiple invites. Multiple invites are still useful because the first accepted player becomes the live opponent.
- Email referrals are stored on the challenge, but automatic email delivery is not wired yet.
- The wallet is now shared per beta account, but transactions and match history are still mostly presentation/demo data on the client.

## Typical Workflow

1. Start the backend with `npm run server:dev` if you need shared accounts, invites, or live rooms across devices.
2. If needed, set both `VITE_API_URL` and `VITE_REALTIME_URL` for the target device.
3. Run `npm run mobile:prep`.
4. Run `npm run mobile:android` to open Android Studio, or `npm run mobile:ios` for Xcode.

Example:
`VITE_API_URL=http://YOUR_COMPUTER_LAN_IP:3001 VITE_REALTIME_URL=http://YOUR_COMPUTER_LAN_IP:3001 npm run mobile:prep`
