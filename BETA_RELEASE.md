# Beta Release Guide

This app can now be shared for remote friend-testing, but there are two pieces to prepare first:

1. a public backend for shared accounts, invites, wallets, and Ludo rooms
2. mobile builds that point to that public backend

## 1. Deploy the backend

Use the included [render.yaml](/Applications/Desktop/The App/skill-based-gaming-platform/render.yaml) blueprint.

What it sets up:

- a Node web service for the shared beta backend
- a persistent disk path for `beta-db.json`
- a health check on `/health`

Important:

- The included Render setup uses the `starter` plan because persistent disks are not available on Render free web services.
- User accounts and posted challenges persist on disk.
- Live Ludo match state is still in server memory, so an active match will reset if the backend restarts during play.

Render steps:

1. Push this project to a Git repo connected to Render.
2. In Render, create a new Blueprint deploy and point it to the repo.
3. Let Render read [render.yaml](/Applications/Desktop/The App/skill-based-gaming-platform/render.yaml).
4. After deploy, copy your public service URL, for example `https://skillarena-beta-api.onrender.com`.
5. Open `/health` on that URL and confirm the API responds.

## 2. Point mobile builds to the live backend

Create a local `.env.production` file using [/.env.production.example](/Applications/Desktop/The App/skill-based-gaming-platform/.env.production.example).

Use your deployed backend URL for both variables:

`VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`

`VITE_REALTIME_URL=https://YOUR-RENDER-SERVICE.onrender.com`

Then run:

`npm run mobile:prep`

That rebuilds the app with the public beta backend baked into the mobile bundle.

## 3. iPhone beta sharing

Recommended path: TestFlight.

High-level flow:

1. Open [App.xcodeproj](/Applications/Desktop/The App/skill-based-gaming-platform/ios/App/App.xcodeproj).
2. Set your Apple team and bundle signing.
3. Build an archive in Xcode.
4. Upload the archive to App Store Connect.
5. Add testers in TestFlight or create a public invite link.

## 4. Android beta sharing

Two good options:

- Google Play internal testing for a managed app-test flow
- Firebase App Distribution for direct APK or AAB tester invites

High-level flow:

1. Run `npm run mobile:prep`.
2. Build the Android app from Android Studio.
3. Upload the build either to Google Play internal testing or Firebase App Distribution.
4. Add tester emails or a tester group.

## 5. What friends can test right now

- shared beta signup and login
- shared wallet balance per beta account
- challenge posting and acceptance
- username-based invite discovery
- live 2-player or 4-player Ludo room joining
- server-authoritative Ludo turn syncing across devices

## 6. Still not fully remote yet

- WordForge, Scrabble Social, Whot, and Grandline Chess do not yet have the same full shared turn-sync that Ludo now has.
- Email invites are stored on challenges but are not automatically delivered yet.
