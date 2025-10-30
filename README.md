# JARVIX Meeting Assistant

Real‑time meeting recorder that transcribes speech, generates summaries and action items, and exports clean notes. Built with Electron + React (Vite, TypeScript).

## Highlights
- Live transcription with fast chunking (Web Audio → WAV → Whisper HTTP)
- “Summarize Now” and auto‑summary on Stop
- Action Items with N/A defaults (Owner | Task | Due | Priority)
- Export to Markdown / Text / JSON
- First‑time tutorial modal; Settings persisted (electron‑store)
- Privacy‑first: API key saved only in macOS Keychain (never bundled)
- Hardened Electron: `contextIsolation`, `sandbox`, secure preload
- Packaging: macOS DMG (unsigned by default), Windows NSIS (optional)

## Quick Start (Development)
```bash
npm install
npm run dev
```
Then in the app:
- Settings → paste OpenAI API key → Test → Save
- Pick microphone → Start → speak → Stop (auto‑summary)

## Build (Production)
macOS (unsigned DMG):
```bash
CSC_IDENTITY_AUTO=false npm run dist:mac
```
Output: `dist/JARVIX Meeting Assistant-<version>-arm64.dmg`

Windows (NSIS):
```bash
npm run dist:win
```

Optional signing + notarization (macOS): set env vars then run `npm run dist:mac`.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- Optionally `CSC_LINK`, `CSC_KEY_PASSWORD` for Developer ID cert

## Publish via GitHub Releases
1) Build the DMG (see above).
2) GitHub → Releases → Draft new release (e.g., `v1.0.0`), upload the DMG as an asset.
3) Copy the asset URL, then set it in `docs/index.html`:
```js
const urls = {
  'mac-arm64': 'https://github.com/<you>/<repo>/releases/download/v1.0.0/JARVIX%20Meeting%20Assistant-1.0.0-arm64.dmg',
  'win': '#'
};
```
Commit and push.

## Deploy the Download Page (Vercel)
A simple landing page lives in `docs/`.
```bash
npm i -g vercel
vercel
vercel --prod
```
The included `vercel.json` serves `/docs/index.html` at the root. The Download button points to the URL configured above.

## Usage Notes
- API key storage: read from/write to macOS Keychain via `keytar`; not bundled.
- Clear key: Settings → Clear (removes Keychain entry).
- Show tutorial anytime: Settings → Help → Show Tutorial.

## Demo Script (≈90s)
1) Settings → paste API key → Test → Save
2) Select mic → confirm meter moves → Start
3) Speak 2–3 sentences; watch transcript appear
4) Click “Summarize Now”; review Summary, Decisions, Action Items (N/A fallbacks)
5) Stop → final summary → Export (Markdown)

## Troubleshooting
- White screen after install: ensure production loads `../../../dist/index.html` in `app/electron/main.ts` (fixed).
- Export menu overlap: resolved via TopBar overflow + z‑index.
- Audio meter not moving: handled by `audioLevel` calculation in `useTranscriptionStream`.
- “Why API is prefilled?” It’s from Keychain. Use Clear in Settings to remove locally.

## Architecture
- Main (prod): `app/electron/main.ts`  |  Main (dev): `app/electron/main.dev.ts`
- Preload (secure IPC surface): `app/electron/preload.ts`
- Renderer (React): `app/renderer/*`
- Transcription: `app/renderer/hooks/useTranscriptionStream.ts`
- Summarizer (LLM): `app/renderer/lib/llm.ts`
- Packaging: `package.json` (electron‑builder), `build/entitlements.*.plist`, `build/notarize.js`

## Security
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- API key in Keychain, no `.env` fallback in dev/prod

## Production Readiness
- End‑to‑end works, DMG builds, landing page deploys, settings persist, first‑run UX present.
- To ship broadly:
  - Sign + notarize mac builds (requires Apple Developer account)
  - Host installers (GitHub Releases/S3) and update landing page URLs
  - Optional: Windows signing, auto‑update, CI release workflow

## License
MIT
