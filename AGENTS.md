# AGENTS.md

## Project

This repository is for Cursor VoiceOps, a hackathon MVP for building, testing, fixing, summarizing, and committing code using voice commands.

The product should feel like a hands-free developer cockpit:

voice command → transcript → intent → safety check → agent task → terminal observation → spoken response → approval when needed.

## Required reading before major work

Before implementing any feature, read these files:

1. MASTER_INTENT.md
2. ROADMAP.md
3. SECURITY.md
4. README.md, if present
5. package.json, if present

## Primary objective

Build the smallest impressive MVP that proves a developer can control a coding workflow without touching the keyboard.

The winning demo must show:

1. A spoken coding task.
2. Live transcription.
3. Intent classification.
4. Safe agent execution.
5. Terminal output streaming.
6. Spoken progress updates.
7. Approval before risky actions.
8. Local commit after confirmation.

## Tech stack

Use this stack unless the user explicitly changes it:

- Frontend: React + Vite + TypeScript
- Backend: Node.js + TypeScript
- Runtime: Node 20+
- Realtime updates: WebSocket or Server-Sent Events
- Voice input: ElevenLabs realtime speech-to-text module, with mock fallback
- Voice output: ElevenLabs text-to-speech module, with browser SpeechSynthesis fallback
- Agent runner: mock runner first, shell runner optional and disabled by default
- Git helpers: local git only
- Testing: Vitest or minimal TypeScript-safe tests

## Hard boundaries

Do not add these unless explicitly requested:

- Database
- Authentication
- Payments
- Cloud deployment
- Multi-user accounts
- Electron
- Complex plugin system
- Full IDE replacement
- Auto-push to GitHub
- Auto-delete outside the repo
- Unrestricted shell execution

## Safety rules

All commands must go through the safety layer.

Never execute raw transcribed speech.

Never execute shell commands directly from user text.

Require explicit approval before:

- rm
- del
- rmdir
- Remove-Item
- git reset
- git clean
- git push
- git commit
- package installation
- file deletion
- branch deletion
- commands outside the repo root
- commands containing sudo
- commands touching .env
- commands touching credentials, tokens, SSH keys, or secrets

Never print secrets.

Never hardcode API keys.

Never log .env contents.

## Voice intents

Support these initial intents:

- BUILD_FEATURE
- RUN_TESTS
- FIX_ERRORS
- SUMMARIZE_DIFF
- CREATE_BRANCH
- COMMIT_CHANGES
- STOP_AGENT
- APPROVE_ACTION
- REJECT_ACTION
- EXPLAIN_STATUS
- DEMO_MODE
- UNKNOWN

Unknown commands should return a short clarification message.

## MVP demo flow

The demo must support this script:

1. User says: “VoiceOps, start demo mode.”
2. App says: “Demo mode ready. Say a coding task.”
3. User says: “Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards.”
4. App transcribes the command.
5. App classifies it as BUILD_FEATURE.
6. App starts the agent runner.
7. Terminal logs stream live.
8. User says: “Run the build.”
9. App runs the build workflow.
10. User says: “Fix the error.”
11. App sends error context to the runner.
12. User says: “Read me what changed.”
13. App summarizes the diff.
14. User says: “Commit it as add voice recipe landing page.”
15. App asks for confirmation.
16. User says: “Confirm commit.”
17. App commits locally.
18. App says: “Committed successfully.”

## Code style

- TypeScript-first.
- Use strict typing where practical.
- Keep files small.
- Keep modules focused.
- Prefer plain functions over large classes.
- Use clear names.
- Avoid clever abstractions.
- Validate inputs at boundaries.
- Add comments only where they clarify important behavior.
- Keep the project demo-reliable.

## Frontend requirements

The dashboard must show:

- Connection status
- Microphone status
- Current transcript
- Parsed intent
- Risk level
- Pending approval prompt
- Agent status
- Terminal logs
- Diff summary
- Last spoken response
- Demo mode controls

The UI should be dark, clean, readable in a screen recording, and optimized for a 90-second hackathon demo.

## Backend requirements

The backend should expose:

- Health check endpoint
- Command submission endpoint
- Approval endpoint
- Rejection endpoint
- Status/log event stream
- Intent classifier
- Safety checker
- Agent runner service
- Git helper service
- Voice service abstractions

## Agent runner requirements

Create an agent runner abstraction:

    export interface AgentRunner {
      runTask(task: AgentTask): AsyncIterable<AgentEvent>;
      stop(): Promise<void>;
    }

Implement:

- MockAgentRunner
- ShellAgentRunner

The shell runner must be disabled by default.

Default environment:

    AGENT_RUNNER_MODE=mock

## Environment variables

Use .env.example as the source of truth.

Required variables:

    PORT=8787
    REPO_ROOT=
    ELEVENLABS_API_KEY=
    ELEVENLABS_VOICE_ID=
    AGENT_RUNNER_MODE=mock
    AGENT_COMMAND=
    BUILD_COMMAND=npm run build
    TEST_COMMAND=npm test
    TYPECHECK_COMMAND=npm run typecheck

## Validation commands

Before finishing any implementation task, run the commands that exist in the repo:

    npm install
    npm run typecheck
    npm run build
    npm test

If a command does not exist, do not invent one. Report that it was unavailable.

If a command fails, fix the issue when possible.

## Completion report format

When finished, report:

1. What changed
2. Files created or edited
3. How to run it
4. Validation results
5. Known limitations
6. Recommended next step

## Do not overbuild

The MVP should prioritize:

- Demo reliability
- Clear voice workflow
- Safety confirmations
- Clean UI
- Easy setup
- Strong hackathon story

Avoid adding features that do not improve the 90-second demo.