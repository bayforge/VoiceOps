# Cursor VoiceOps

Cursor VoiceOps is a hands-free developer cockpit for building, testing, fixing, summarizing, and committing code with voice commands.

Pitch: **Voice in. Cursor builds. ElevenLabs talks back. No keyboard.**

## What It Does

- Captures a spoken or typed command.
- Shows the live transcript and classified intent.
- Runs every action through a safety layer.
- Streams agent and terminal events to the dashboard.
- Speaks progress with browser SpeechSynthesis fallback.
- Requests confirmation before risky actions such as commits and branches.
- Creates local commits only after approval.

## Quick Start

Requirements:

- Node 20 or newer
- Git

Install dependencies:

```bash
npm install
```

Copy environment defaults:

```bash
copy .env.example .env
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

## Mock Demo Flow

The default runner is safe mock mode:

```env
AGENT_RUNNER_MODE=mock
```

Use the dashboard buttons or say/type this script:

1. `VoiceOps, start demo mode.`
2. `Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards.`
3. `Run the build.`
4. `Fix the error.`
5. `Read me what changed.`
6. `Commit it as add voice recipe landing page.`
7. `Confirm commit.`

## Optional Shell Runner

Shell execution is disabled by default. To opt in, set:

```env
AGENT_RUNNER_MODE=shell
AGENT_COMMAND=
BUILD_COMMAND=npm run build
TEST_COMMAND=npm test
TYPECHECK_COMMAND=npm run typecheck
```

The shell runner only uses configured commands. It does not execute raw transcript text.

## ElevenLabs

The app works without ElevenLabs keys. Browser SpeechSynthesis is used for spoken responses.

Server-side ElevenLabs integration boundaries are present behind:

```env
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

Keep keys out of client-side environment variables.

## API

- `GET /health`
- `GET /state`
- `GET /events`
- `POST /commands`
- `POST /approvals`
- `POST /rejections`

## Validation

Run the available validation commands:

```bash
npm run typecheck
npm run build
npm test
```

## Safety Model

Voice input is untrusted. The backend normalizes the transcript, classifies intent, creates a structured action, checks safety, requests approval when required, then runs the selected workflow.

Approval is required for commits, branch creation, destructive commands, package installation, `sudo`, `.env` access, and secret-like paths.
