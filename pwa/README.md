# SkillArena PWA

This folder is a separate Progressive Web App package for sharing the browser build with friends.

It keeps its own deploy settings so you can point Vercel or Netlify directly at `pwa/`.

The actual app code used by the hosted build lives in `pwa/app-src/`, which is a synced copy of the main `src/` folder.

## Local use

From the repo root:

```bash
npm run pwa:sync
npm run pwa:dev
npm run pwa:build
```

From inside this folder:

```bash
npm install
npm run typecheck
npm run dev
```

## Deploy on Vercel

1. Import this GitHub repo into Vercel.
2. Set the Root Directory to `pwa`.
3. Keep the build command as `npm run build`.
4. Set the output directory to `dist`.

## Deploy on Netlify

1. Connect this GitHub repo in Netlify.
2. Set the Base directory to `pwa`.
3. Set the build command to `npm run build`.
4. Set the publish directory to `dist`.

## Optional environment variables

If you later host the multiplayer API, add these in Vercel or Netlify:

```bash
VITE_API_URL=https://your-api-host.example.com
VITE_REALTIME_URL=https://your-realtime-host.example.com
```

If you do not set them, the PWA still opens in local preview mode with mock players and challenge data, which is useful for UI testing with friends.
