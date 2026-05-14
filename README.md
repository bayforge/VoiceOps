# Cursor VoiceOps

Cursor VoiceOps is a hands-free developer cockpit for building, testing, fixing, summarizing, and committing code with voice commands.

## Pitch

Voice in. Cursor builds. ElevenLabs talks back. No keyboard.

## What it does

The app lets a developer say commands like:

- “Create a landing page.”
- “Run the build.”
- “Fix the error.”
- “Read me what changed.”
- “Commit it as add voice recipe landing page.”
- “Confirm commit.”

The system transcribes the command, classifies the intent, checks safety, runs the correct workflow, streams terminal output, speaks progress updates, and asks for confirmation before risky actions.

## Hackathon goal

This project is optimized for a 90-second demo showing that a developer can ship a feature without touching the keyboard.

## MVP stack

- React
- Vite
- TypeScript
- Node.js
- ElevenLabs speech-to-text
- ElevenLabs text-to-speech
- Mock voice fallback
- Mock agent runner
- Optional shell runner
- Local git helpers

## Quick start

Install dependencies:

```bash
npm install