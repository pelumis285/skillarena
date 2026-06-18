# Online Play Setup

This app now has two separate deploy targets:

1. `pwa/` for the shareable web client
2. the root Node server in `server/` for live auth, wallet sync, challenges, and Socket.IO game rooms

## Recommended live setup

- Frontend: Vercel
- Backend + realtime: Render web service using [`render.yaml`](./render.yaml)

## Current low-cost test mode

The current `render.yaml` is set to Render's `free` instance type.

Important tradeoffs for this mode:

- Free Render web services spin down after 15 minutes without inbound traffic.
- The next request or new WebSocket connection can take about one minute while the service wakes up.
- Free Render web services do not support persistent disks.
- Because of that, the SQLite database file can still be lost whenever the service redeploys, restarts, or spins down on the free plan.

This is fine for early friend testing, but not ideal for a smooth realtime game experience.

## Backend environment variables

- `ALLOWED_ORIGINS`
  - comma-separated frontend origins that may call the API and open Socket.IO connections
  - keep the mobile app origins too, especially `capacitor://localhost` and `http://localhost`
  - example:

```bash
ALLOWED_ORIGINS=https://pwa-ebon-mu.vercel.app,https://your-custom-domain.com,capacitor://localhost,http://localhost
```

- `SKILLARENA_ADMIN_EMAILS`
  - comma-separated email addresses that should open the app with admin privileges
  - example:

```bash
SKILLARENA_ADMIN_EMAILS=you@example.com,partner@example.com
```

On a brand-new database, the very first account created is also promoted to admin automatically.

## Frontend environment variables

Set these in the Vercel project for `pwa/` after the backend is live:

```bash
VITE_API_URL=https://your-backend.onrender.com
VITE_REALTIME_URL=https://your-backend.onrender.com
```

Then redeploy the frontend so the shared link points at the real backend.

## When you want a smoother test

Upgrade the Render service from `free` to `starter` and add a persistent disk-backed database path with `SKILLARENA_DB_PATH`. That removes the free-tier sleep behavior and lets the SQLite database survive service restarts.
