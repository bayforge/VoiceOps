# ROADMAP.md

## Phase 1: Project skeleton

Goal: create the minimum working app structure.

Tasks:

- Create React + Vite + TypeScript frontend.
- Create Node + TypeScript backend.
- Add shared types.
- Add health endpoint.
- Add status/log stream.
- Add dark dashboard UI.

Acceptance criteria:

- Frontend starts.
- Backend starts.
- UI connects to backend.
- Logs can appear in UI.
- No ElevenLabs integration required yet.

## Phase 2: Command pipeline

Goal: support typed command input before voice.

Tasks:

- Add text command endpoint.
- Add transcript state.
- Add intent classifier.
- Add action router.
- Add safety checker.
- Add pending approval state.
- Add response messages.

Acceptance criteria:

- User can type a command.
- UI shows transcript.
- UI shows parsed intent.
- UI shows risk level.
- UI shows status.
- Risky actions create approval prompts.

## Phase 3: Voice layer

Goal: add speech input and spoken output.

Tasks:

- Add microphone capture.
- Add mock STT mode.
- Add ElevenLabs realtime STT service module.
- Add browser SpeechSynthesis fallback.
- Add ElevenLabs TTS service module.
- Keep the app usable without API keys.

Acceptance criteria:

- App works in mock mode.
- App can speak responses using browser fallback.
- ElevenLabs code is isolated behind environment variables.
- Missing API keys do not crash the app.

## Phase 4: Agent runner

Goal: simulate and optionally execute agent workflows safely.

Tasks:

- Add AgentRunner interface.
- Add MockAgentRunner.
- Add disabled-by-default ShellAgentRunner.
- Add terminal log streaming.
- Add stop/cancel support.
- Add build/test command support.

Acceptance criteria:

- Demo mode streams realistic agent logs.
- Shell mode cannot run unless configured.
- All commands go through safety checks.

## Phase 5: Git workflows

Goal: summarize and commit changes safely.

Tasks:

- Add git status helper.
- Add git diff summary helper.
- Add create branch helper.
- Add local commit helper.
- Require approval before commit.
- Do not add auto-push.

Acceptance criteria:

- User can ask “what changed?”
- User can create a local commit only after confirmation.
- App never pushes automatically.

## Phase 6: Hackathon polish

Goal: make the project demo-ready.

Tasks:

- Add demo script button.
- Improve UI readability.
- Add status timeline.
- Add README.
- Add setup instructions.
- Add video recording instructions.
- Run full build and test.

Acceptance criteria:

- 90-second demo works reliably.
- The app is understandable on video.
- README explains how to run mock mode.
- README explains how to enable ElevenLabs.