# Agent Canvas App: Voice

An [OpenHands](https://www.openhands.dev/) Agent Canvas app to talk with the agent: it reads the agent's replies aloud after you use Canvas's mic and listens again, hands-free if you like, adds read aloud buttons to the agent's messages, and understands a few spoken commands.

## Features

### Talking

| Name | What it does |
| :-- | :-- |
| **Voice chat** | After you speak a message with Canvas's mic, sends it, reads the agent's reply aloud, then turns the mic back on for your next message, keeping a phone's screen awake meanwhile. Code stays in the chat rather than being read out, and it tells you when the agent needs your confirmation or stops with an error. Say "stop" to press Canvas's Stop, "never mind" to send nothing, "repeat that" to hear the last reply again, or "new chat" to start one. Pressing a key or opening another conversation stops it. |
| **Hands-free** | Stops Canvas's mic once you stop talking, or after 10 seconds of silence, so with Voice chat you never have to tap it. |
| **Listening chime** | Plays a short chime when Voice chat turns the mic back on, so you know when to talk. |
| **Keyboard shortcut** | <kbd>Alt</kbd>+<kbd>V</kbd> starts or stops Canvas's mic, from the message box too. |

### Reading aloud

| Name | What it does |
| :-- | :-- |
| **Read aloud buttons** | Adds a button beside the copy button on the agent's messages that reads the message aloud, or stops reading it. <kbd>Esc</kbd> stops it too. |
| **On-device voices only** | On by default. Only lists and uses voices that run on your device, so what's read aloud never goes to Google or Microsoft. Turn it off for their online voices, such as Edge's "Natural" ones and Chrome's Google voices, which often sound better. |
| **Voice** | Which of your browser's English voices reads aloud. **Automatic** picks the best one for your region, as [Readium Speech](https://github.com/readium/speech) rates them. The list groups them by region, best first, with each one's quality and whether it sends what it reads online underneath, hides novelty voices, and reads a sample in each voice you pick, which **Preview** plays again. |
| **Reading speed** | How fast replies and messages are read, from 0.75× to 2×. |
| **Volume** | How loud replies, messages and the listening chime are, from 25% to 100% of your device's volume. |

## Install

Voice needs a local Agent Server, as Canvas doesn't offer apps on OpenHands Cloud backends.

1. Visit **Customize > Apps** (`/apps`)
2. Click **Add app** at the top right
3. For the App source, enter:
   ```
   github:RobLoach/openhands-app-voice
   ```
4. Click **Install**
5. **Enable** the Voice app
6. Open **Customize > Voice**, under Apps, and turn on the features you want

Voice chat uses Canvas's own mic. Without a **Voice input** server under Canvas's **Settings**, Chrome sends what you say to Google to transcribe, and some Linux builds of Chromium can't at all. A [Whisper-compatible server](https://github.com/hwdsl2/scribecrate) of your own, under **Settings > Voice input**, keeps it on your network and works in Firefox too.

## Development

- The app's source is in [`src/`](src), one module per feature, from [`src/index.js`](src/index.js). Canvas loads an app from one file, so `npm run build` bundles them, and [Readium Speech](https://github.com/readium/speech), with Rollup into [`extension.js`](extension.js), which is checked in. `npm test` builds it first, and CI checks it matches `src/`.
- Readium Speech finds, rates and ranks the browser's voices, from its recommended voices. Only its English ones are bundled so far, as the app only reads English; `LANGUAGES` in [`rollup.config.js`](rollup.config.js) adds others. The licenses of what it bundles are in [`THIRD_PARTY_LICENSES.txt`](THIRD_PARTY_LICENSES.txt), which the build writes too.
- The settings page is an app page, which Canvas serves at `/extensions/openhands-app-voice/settings`, as it has no way for an app to add a page under Customize. The app adds the settings page to Customize's menu itself, after [Extras](https://github.com/RobLoach/agent-canvas-app-extras)' when that's installed too, and hides its own sidebar link.
- Canvas has no app API for its mic, chat or menus. The app works with Canvas's markup directly (its mic, message box, send and stop buttons, the agent's messages and Customize's menu), so an OpenHands update that changes it can break a feature.
- Settings are kept in the browser's `localStorage`, under `openhands-voice:settings`, so they're per browser rather than per backend.
- While Voice chat waits for a reply, it asks the Agent Server about that one conversation every 2 seconds. Hands-free opens a second stream from the mic to hear when you've stopped talking, as Canvas's mic gives no sign of it.

### Tests

The tests run `extension.js` against a Canvas-like page in [jsdom](https://github.com/jsdom/jsdom) with Node's built-in test runner. They need Node 20.19, 22.13 or 24 and newer.

```
npm ci
npm test
```

GitHub Actions runs them on every pull request and push to `main`.

## License

[MIT](LICENSE)
