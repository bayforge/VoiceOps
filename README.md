# Cursor VoiceOps

Cursor VoiceOps is a hands-free developer cockpit for building, testing, fixing, summarizing, and committing code with voice commands.

Phase 1/2 currently supports the project skeleton, a dark dashboard, typed command input, intent classification, safety checks, pending approvals, server-sent status updates, and mock terminal responses.

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
- Mock-only command responses

Not implemented yet: ElevenLabs, browser speech output, shell execution, git diff, branch creation, or local commits.

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
