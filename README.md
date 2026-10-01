# Physique

Aesthetics-first hypertrophy planner and workout log. A static web app you install on your iPhone
from Safari ("Add to Home Screen"): its own icon, full screen, works offline, data stays on the phone.

## Put it on your iPhone

The app has to be online at an `https://` address once so Safari can install it. GitHub Pages is free:

1. Create a free account at github.com.
2. New repository → name it `physique` → **Public** → Create.
3. On the new repo page click **uploading an existing file**, drag in everything *inside* this folder
   (`index.html`, `manifest.webmanifest`, `sw.js`, and the `css`, `js`, `icons` folders) → **Commit changes**.
4. Repo **Settings → Pages** → Source: **Deploy from a branch** → `main` / `(root)` → **Save**.
5. After about a minute the app is at `https://<your-username>.github.io/physique/`.
6. Open that link in **Safari** on the iPhone → Share → **Add to Home Screen**.
7. Open it from the home screen and do the setup there. The installed app keeps its own data,
   separate from Safari.

Only the code is public. Your workouts never leave the phone.

## Your data

Everything is stored on the device. Settings → **Export backup** saves a JSON file (e.g. to iCloud
Drive); **Import backup** restores it, also on a new phone.

## Updating the app

Change the files, bump `VERSION` in `sw.js` (e.g. `physique-v2`), upload again. The phone picks up
the new version on the next launch after that.

## Local preview

From the project folder: `python tools/devserver.py`, then open http://localhost:8765/physique-app/.
Add `?sw=1` to test the offline service worker on localhost.

## How the plan works

- `js/data.js`: muscles, priority tiers, movement slots, exercise library (gym + home), splits.
- `js/engine.js`: weekly targets (fractional sets), plan generation and time-cap trimming,
  exercise choice, double progression with the home technique ladder, volume, fatigue and stalls.
- `js/app.js`: the screens. `js/body.js`: the muscle map. `js/charts.js`: charts.
