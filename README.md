# OffKey

A minimal two-video playback test for a karaoke host’s laptop and TV.

## Stack decision

- Frontend: React, TypeScript, and Vite.
- Future backend: Python and FastAPI. No backend has been implemented yet.
- Hosting provider, room storage, and shared queue transport remain undecided.

This increment uses the YouTube IFrame Player API directly, without an API key. It has no rooms, guest accounts, QR codes, shared queues, or YouTube search. Playback state lives only in this browser and resets on reload.

## Run locally

Use Node.js 22.12+ (or 20.19+) and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use the HTTP URL, rather than opening `index.html` from disk. YouTube needs the page’s origin and a referrer; the page uses `strict-origin-when-cross-origin` and passes its origin to the player.

## Test on the laptop and TV

1. Paste two exact YouTube video URLs. Watch, short, embed, Shorts, and live video URLs are accepted; playlist-only links and raw video IDs are rejected. Timestamp and playlist parameters are ignored: the selected video starts at the beginning.
2. Click **Start test**. Verify audible video playback on the TV using the laptop’s audio output.
3. Let video one finish, or seek near its end using YouTube’s controls. Confirm video two starts automatically.
4. Pause and resume with both the app and YouTube controls. Click **Skip video** during video one to advance early.
5. Let video two finish. Confirm the sequence stops and shows **Test complete**. Skipping video two also ends the sequence.
6. Try a video whose owner disallows embedding, or an unavailable video. Confirm an error is displayed and it remains selected until you retry or skip it. For rapid testing, an unavailable ID can be entered as `https://www.youtube.com/watch?v=AAAAAAAAAAA`; its availability is not guaranteed.
7. If the browser blocks automatic playback, confirm a recovery message appears and **Resume playback** works. This may require testing in a browser/profile that restricts autoplay. A Start click does not guarantee autoplay permission for later videos.
8. **Reset test** stops the current session and unlocks the links. Links stay entered for convenience.

Real embedding permissions, ads, and autoplay behavior are controlled by YouTube and the browser. Mocked automated checks cannot establish that a given karaoke video will play on the actual laptop/TV setup.

## Verification

```sh
npm run build
npm test
```

Browser checks use a simulated YouTube IFrame API to verify validation, playback controls, automatic advancement, repeated/late events, blocked autoplay recovery, and embedding errors. The test runner uses Chromium; install it with `npx playwright install chromium` if needed. Set `PLAYWRIGHT_CHROME_CHANNEL=chrome` to use an installed Google Chrome instead.

## Next decision

Review playback on the laptop and TV before adding rooms. The future FastAPI backend will need to enforce host-only queue mutations and advancement; this browser-only prototype is not that authorization boundary.
