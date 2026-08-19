# Harvest Out Run — deploy

A Pole Position-shaped time trial around the yard, in a forklift, a scissor
lift, a service van or a box truck. One lap, fastest time wins.

Set it up the same way as Soundcheck: a GitHub repo, Netlify building from it.
**Git, not drag-and-drop** — the function imports `@netlify/blobs`, and a
drag-and-drop deploy runs no `npm install`, so the import would crash and the
board would silently fall back to browser-only. (That exact thing happened to
Soundcheck once.)

```
index.html          <- the whole game, one file, nothing to fetch
netlify.toml        <- publish dir, functions dir, API cache header
package.json        <- declares @netlify/blobs for the build
netlify/
  functions/
    times.mjs       <- the lap-time board, routed to /api/times
```

The `netlify/functions/` nesting is the one thing that must not be flattened;
that path is how Netlify finds the function.

## After deploying

Open `/api/times`. `[]` means it works and nobody has set a time yet. A 404
means the function didn't deploy — check the folder nesting.

In-game the board header tells you which backend you got:

| Header | Meaning |
| --- | --- |
| `BEST LAPS — LIVE` | The real shared board. What you want. |
| `BEST LAPS — THIS BROWSER ONLY` | No function reachable; times are local to that browser. |

Then add it to the Hub's Arcade tab — one entry in `GAMES` in
`src/components/Game.jsx`.

## The board is per rig

Ten times kept for each of the four rigs, not ten overall. A box truck will
always beat a scissor lift, so a single board would only ever be a box truck
board and nobody would touch the slow ones. Per rig, the forklift becomes its
own competition.

## How it drives

| Rig | Top speed | Grip | The idea |
| --- | --- | --- | --- |
| Forklift | lowest | highest | Turns on a dime, tops out at a jog |
| Scissor lift | very low | lowest | Barely legal on a track; tippy and slow |
| Service van | high | medium | The all-rounder |
| Box truck | highest | low | Fast in a straight line, a handful in corners |

Off the tarmac each rig drops to a fraction of its top speed — the van keeps
the most, the scissor lift the least. Hitting traffic or scenery costs speed
and briefly takes the steering away.

## Cheating

The time is a number in a POST body, so anyone with devtools can send whatever
they like. The function clamps times to 8–900 seconds and strips HTML from
names, so a bad request can't corrupt the board or inject anything — but it
can't tell a real 41 seconds from an invented one. For coworkers that's fine.
To wipe the board, change `KEY` in `times.mjs` from `times-v1` to `times-v2`
and redeploy.
