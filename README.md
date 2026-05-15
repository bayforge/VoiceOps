# Cursor VoiceOps

Cursor VoiceOps is a hands-free developer cockpit for building, testing, fixing, summarizing, and committing code with voice commands.

Phase 1-5 currently supports the project skeleton, a dark dashboard, typed command input, intent classification, safety checks, pending approvals, server-sent status updates, mock terminal responses, microphone capture, mock speech-to-text, browser speech output, env-gated ElevenLabs service modules, runner abstractions, build/test workflows, and local git summary/commit helpers.

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
- Agent runner abstraction with mock mode by default
- Optional shell runner gated by `AGENT_RUNNER_MODE=shell`
- Build/test/typecheck command workflows
- Git status and diff summary helpers
- Local branch and commit helpers after approval

Not implemented yet: auto-push, cloud deployment, authentication, or unrestricted shell execution.

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

## Runner Configuration

The safest demo path is the default mock runner:

```env
AGENT_RUNNER_MODE=mock
BUILD_COMMAND=npm run build
TEST_COMMAND=npm test
TYPECHECK_COMMAND=npm run typecheck
```

To opt into shell execution, set `AGENT_RUNNER_MODE=shell` and configure `AGENT_COMMAND`. Voice transcripts are never executed directly; the shell runner only executes configured commands that pass the safety layer.

## Mock Demo Flow

Use the dashboard buttons or type this script:

1. `VoiceOps, start demo mode.`
2. `Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards.`
3. `Run the build.`
4. `Fix the error.`
5. `Read me what changed.`
6. `Commit it as add voice recipe landing page.`
7. `Confirm commit.`

Commit and branch commands create approval prompts. After confirmation, the server runs local git helpers only; it never pushes automatically.

## Validation

Run the available validation commands:

```bash
npm run typecheck
npm run build
npm test
```
