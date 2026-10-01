# Physique

A muscle-building planner and workout log that runs on your phone like an app. Free, no account, no ads.

## Install

**iPhone:** open **https://raphschweiger-dev.github.io/physique/** in **Safari** → tap Share → **Add to Home Screen**.
Then open it from the home screen and do the setup there. The installed app keeps its own data, separate from Safari.

**Android:** open the link in Chrome → menu (⋮) → **Install app** or **Add to Home screen**.

After the first visit it works offline, so a bad gym connection doesn't matter.

## What it does

- **Builds your week.** Pick 2–6 training days. You get a split with sets per muscle, effort targets and rest
  times that fit your session length. You can change the number of days anytime and keep your history.
- **Gym, Home or Anywhere.** Before each workout, pick where you are. Home uses the equipment you own.
  Anywhere needs nothing but bodyweight, a door and maybe a chair. Every location trains the same
  muscles with the same weekly sets; only the exercises change.
- **Muscle priorities.** Start from Upper-body focus, Balanced or Lower-body focus, then set each muscle to
  Priority, Grow, Maintain or Indirect.
- **Progressive overload.** Every exercise shows what you did last time and what to beat today. Hit the top of
  the rep range on every set and it adds weight. When you run out of heavier weights, it makes the
  exercise harder instead: slower reps, pauses, 1½ reps, harder variations.
- **Tracks every muscle.** A front/back body heatmap and weekly volume per muscle. Helper muscles count as half
  a set.
- **Adjusts to you.** A 10-second check-in after each workout fine-tunes next sets per muscle. Volume and
  effort build over a 5-week block, then a lighter week clears fatigue, or earlier if performance drops.
- **Progress.** Strength charts per exercise, personal records, bodyweight and body measurements.

## Your data

Everything stays on your phone. There is no account and nothing is uploaded anywhere.
Use **Settings → Export backup** now and then to keep a copy (e.g. in iCloud Drive) or to move to a new phone.

## The science behind it

| Topic | Default | Research |
|---|---|---|
| Volume | 10–20+ hard sets per muscle per week, helper muscles count ½ | Schoenfeld 2017, Pelland 2024 |
| Frequency | each muscle at least twice a week | Schoenfeld 2016 |
| Effort | stop 0–3 reps before failure | Robinson 2024 |
| Reps | 6–12 on big lifts, 10–20 on isolation, up to 30 with light weights | Schoenfeld 2017, Lasevicius 2018 |
| Exercise choice | load the muscle in its stretched position | Maeo 2021/2023, Pedrosa 2022 |
| Rest | 2–3 min big lifts, ~1.5 min isolation | Schoenfeld 2016, Singer 2024 |
| Progression | add reps, then weight | Plotkin 2022 |

No plan is perfect for everyone, so these are starting points that your logs and check-ins adjust.

## For developers

Plain HTML, CSS and JavaScript with no build step. Serve the folder with any static web server.
When you change files, bump `VERSION` in `sw.js` so installed copies pick up the update.
