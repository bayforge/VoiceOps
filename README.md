# Cursor VoiceOps

Cursor VoiceOps is a hands-free developer cockpit for building, testing, fixing, summarizing, and committing code with voice commands.

Phase 1/2 currently supports the project skeleton, a dark dashboard, typed command input, intent classification, safety checks, pending approvals, server-sent status updates, and mock terminal responses. Phase 3 adds microphone capture, mock speech-to-text, browser speech output, and env-gated ElevenLabs service modules.

## Current Scope

- React + Vite + TypeScript frontend
- Node + TypeScript backend
- Shared TypeScript types
- `GET /health`
- `GET /state`
- `GET /events` status/log stream
- `POST /commands`
- `POST /approvals`
- `POST /rejections`
- `GET /voice/config`
- `POST /voice/stt-session`
- `POST /voice/tts`
- Mock-only command responses

Not implemented yet: shell execution, git diff, branch creation, or local commits.

## Quick Start

Requirements:

- Node 20 or newer

Install dependencies:

```bash
npm install
```

Run the backend:

```bash
npm run dev:server
```

Run the frontend in a second terminal:

```bash
npm run dev:client
```

Open `http://127.0.0.1:5173`.

## Voice Configuration

The app runs without ElevenLabs credentials by default:

```env
VOICE_STT_MODE=mock
VOICE_TTS_MODE=browser
```

To enable ElevenLabs-backed services, set these values on the server:

```env
VOICE_STT_MODE=elevenlabs
VOICE_TTS_MODE=elevenlabs
ELEVENLABS_API_KEY=your-api-key
ELEVENLABS_VOICE_ID=your-voice-id
ELEVENLABS_STT_MODEL_ID=scribe_v2_realtime
ELEVENLABS_TTS_MODEL_ID=eleven_flash_v2_5
```

If the API key or voice ID is missing, the server falls back to mock STT and browser TTS. The browser only receives redacted voice capability settings and single-use STT session tokens.

## Mock Demo Flow

Use the dashboard buttons or type this script:

1. `VoiceOps, start demo mode.`
2. `Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards.`
3. `Run the build.`
4. `Fix the error.`
5. `Read me what changed.`
6. `Commit it as add voice recipe landing page.`
7. `Confirm commit.`

Commit and branch commands create approval prompts, but approvals only resolve mock state. No git command is run in Phase 1/2.

## Validation

Run the available validation commands:

```bash
npm run typecheck
npm run build
npm test
```
