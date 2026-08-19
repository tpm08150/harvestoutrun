// Harvest Out Run — shared lap times
//
// GET  /api/times  -> every kept time as JSON
// POST /api/times  -> body {name, time, rig} ; returns the updated board
//
// Storage is Netlify Blobs, built into Netlify — no database, no API keys.
// The board lives in one JSON blob.
//
// Two differences from the Soundcheck board this is modelled on:
//
//   - **Lower is better.** Sorting is ascending, and a "best" is a minimum.
//   - **Ten kept per rig, not ten overall.** A box truck will always beat a
//     scissor lift, so one combined board would only ever be a box truck
//     board and nobody would drive the slow rigs. Keeping a top ten per rig
//     is what makes the forklift worth a go.
//
// Everything is validated here. The time is just a number in a POST body, so
// anyone can curl a fake one; the bounds below stop a bad request corrupting
// the board, but they are not anti-cheat.

import { getStore } from '@netlify/blobs';

const KEY = 'times-v1';
const PER_RIG = 10;
const MIN_TIME = 8;      // nothing legitimate gets round the yard faster
const MAX_TIME = 900;    // 15 minutes; a scissor lift that gave up
const RIGS = ['forklift', 'scissor', 'van', 'boxtruck'];

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Validate, then keep the fastest PER_RIG for each rig. */
const clean = (arr) => {
  const rows = (Array.isArray(arr) ? arr : [])
    .filter((e) => e && typeof e.time === 'number' && isFinite(e.time))
    .map((e) => ({
      // Three initials, cabinet style — the same as Soundcheck. Enforced here
      // as well as in the page, because the page is not the only thing that can
      // POST. The board needs no reset: every name on it already fits.
      name: String(e.name ?? 'AAA').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'AAA',
      time: Math.round(Math.max(MIN_TIME, Math.min(MAX_TIME, e.time)) * 1000) / 1000,
      rig: RIGS.includes(e.rig) ? e.rig : 'van',
      when: Number(e.when) || Date.now(),
    }))
    .sort((a, b) => a.time - b.time || a.when - b.when);

  const kept = [];
  for (const rig of RIGS) kept.push(...rows.filter((r) => r.rig === rig).slice(0, PER_RIG));
  return kept.sort((a, b) => a.time - b.time);
};

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: JSON_HEADERS });
  }

  let store;
  try {
    store = getStore('outrun');
  } catch (err) {
    return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
  }

  if (request.method === 'GET') {
    try {
      const raw = await store.get(KEY, { type: 'json' });
      return new Response(JSON.stringify(clean(raw)), { status: 200, headers: JSON_HEADERS });
    } catch (err) {
      return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
    }
  }

  if (request.method === 'POST') {
    let entry;
    try {
      entry = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: JSON_HEADERS });
    }

    const time = Number(entry?.time);
    if (!isFinite(time) || time < MIN_TIME || time > MAX_TIME) {
      return new Response(JSON.stringify({ error: 'bad time' }), { status: 400, headers: JSON_HEADERS });
    }

    const row = clean([{ name: entry?.name, time, rig: entry?.rig, when: Date.now() }])[0];

    // Read-modify-write, same caveat as Soundcheck: two people finishing in
    // the same second could have one write clobber the other. Fine at this
    // scale, and Blobs exposes no compare-and-set to do better.
    let current = [];
    try {
      current = (await store.get(KEY, { type: 'json' })) || [];
    } catch (err) {
      current = [];
    }

    const next = clean([...(Array.isArray(current) ? current : []), row]);

    try {
      await store.setJSON(KEY, next);
    } catch (err) {
      return new Response(JSON.stringify(next), { status: 200, headers: JSON_HEADERS });
    }
    return new Response(JSON.stringify(next), { status: 200, headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: JSON_HEADERS });
};

export const config = { path: '/api/times' };
