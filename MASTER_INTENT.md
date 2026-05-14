# MASTER_INTENT.md

## Product name

Cursor VoiceOps

## One-sentence pitch

A hands-free developer cockpit that lets you build, test, fix, summarize, and commit code using only your voice.

## Hackathon positioning

Cursor VoiceOps is built for the ElevenLabs + Cursor hackathon.

The challenge is to build something useful without touching a keyboard. This project directly answers that by letting a developer control a coding workflow through speech.

This should not feel like a generic voice assistant. It should feel like a voice-operated coding cockpit.

## Core idea

A developer speaks a task:

“Create a landing page, run the build, fix any errors, summarize what changed, and commit it.”

The system:

1. Transcribes the command.
2. Classifies the intent.
3. Checks safety.
4. Sends structured work to a coding agent runner.
5. Streams terminal output.
6. Summarizes results.
7. Speaks status updates.
8. Requires confirmation before risky actions.
9. Creates a local commit only after approval.

## Target user

Primary users:

- Developers who want to code hands-free
- Developers with RSI
- Developers with temporary hand injuries
- Developers who need accessibility-first coding tools
- Developers who want voice-controlled AI coding workflows

Secondary users:

- Hackathon judges
- Cursor users
- ElevenLabs users
- Technical creators
- Accessibility advocates

## Winning demo

The demo must be understandable within 10 seconds.

The viewer should see:

1. Hands visibly away from the keyboard.
2. A voice command.
3. Live transcription.
4. The agent starts working.
5. Terminal output streams.
6. The app speaks progress updates.
7. The app asks for approval before commit.
8. The user confirms by voice.
9. A local commit is created.

Final demo message:

“Voice in. Cursor builds. ElevenLabs talks back. No keyboard.”

## Product principles

### 1. Demo reliability beats feature count

A polished 90-second flow is better than a large fragile app.

### 2. Safety is a feature

Voice commands are untrusted input. The app must never blindly execute destructive actions.

### 3. Voice is the interface

The product should be designed around speaking and listening, not keyboard-first controls.

### 4. The agent does the coding

This app coordinates coding workflows. It is not a full IDE.

### 5. The screen should help the video

Every UI element should be readable in a screen recording.

## MVP feature set

### Must have

- Voice command capture
- Text command fallback
- Mock STT mode
- ElevenLabs STT integration module
- Browser TTS fallback
- ElevenLabs TTS integration module
- Intent classifier
- Safety checker
- Pending approval state
- Agent runner abstraction
- Mock agent runner
- Optional shell runner
- Terminal log streaming
- Diff summary workflow
- Local commit workflow with approval
- Demo mode

### Should have

- Stop/cancel command
- Build command
- Test command
- Transcript history
- Status timeline
- Error summary
- Spoken response queue

### Could have

- GitHub PR creation
- Cursor CLI profile selector
- Codex CLI profile selector
- Wake word
- Multiple voice options
- Agent memory
- Accessibility presets

### Do not build for MVP

- Login
- Database
- Billing
- Cloud hosting
- Team accounts
- Marketplace
- Full IDE replacement
- Complex natural-language planning UI

## Voice intents

### BUILD_FEATURE

User wants the agent to create or modify code.

Examples:

- “Build a dashboard.”
- “Create a landing page.”
- “Add a pricing section.”
- “Make the button work.”

### RUN_TESTS

User wants validation.

Examples:

- “Run tests.”
- “Run the build.”
- “Check if it passes.”

### FIX_ERRORS

User wants the agent to repair failures.

Examples:

- “Fix the error.”
- “Resolve the failing test.”
- “Make the build pass.”

### SUMMARIZE_DIFF

User wants a spoken summary of changes.

Examples:

- “What changed?”
- “Summarize the diff.”
- “Read me the changes.”

### COMMIT_CHANGES

User wants a local git commit.

Examples:

- “Commit this.”
- “Commit it as add dashboard.”
- “Create a commit.”

This requires confirmation.

### CREATE_BRANCH

User wants a new git branch.

Examples:

- “Create a branch called voice demo.”
- “Start a new branch.”

This requires confirmation.

### APPROVE_ACTION

User approves a pending action.

Examples:

- “Confirm.”
- “Approve.”
- “Yes, commit.”
- “Confirm commit.”

### REJECT_ACTION

User rejects a pending action.

Examples:

- “Cancel.”
- “No.”
- “Reject.”
- “Do not do that.”

### STOP_AGENT

User wants the current job stopped.

Examples:

- “Stop.”
- “Cancel the agent.”
- “Abort.”

### EXPLAIN_STATUS

User wants current status.

Examples:

- “What are you doing?”
- “What is happening?”
- “Read status.”

### DEMO_MODE

User wants a scripted demonstration.

Examples:

- “Start demo mode.”
- “Run the hackathon demo.”

## Structured action shape

Use this TypeScript shape when implementing shared types:

    export type VoiceIntent =
      | "BUILD_FEATURE"
      | "RUN_TESTS"
      | "FIX_ERRORS"
      | "SUMMARIZE_DIFF"
      | "CREATE_BRANCH"
      | "COMMIT_CHANGES"
      | "STOP_AGENT"
      | "APPROVE_ACTION"
      | "REJECT_ACTION"
      | "EXPLAIN_STATUS"
      | "DEMO_MODE"
      | "UNKNOWN";

    export type VoiceAction = {
      intent: VoiceIntent;
      rawTranscript: string;
      normalizedText: string;
      confidence: number;
      payload?: Record<string, unknown>;
      requiresApproval: boolean;
      riskLevel: "low" | "medium" | "high";
    };

## Agent task shape

Use this TypeScript shape when implementing agent tasks:

    export type AgentTask = {
      id: string;
      type:
        | "feature"
        | "test"
        | "fix"
        | "summarize"
        | "branch"
        | "commit"
        | "demo";
      prompt: string;
      repoRoot: string;
      requiresApproval: boolean;
      approved: boolean;
    };

## Agent event shape

Use this TypeScript shape when implementing agent events:

    export type AgentEvent = {
      type:
        | "started"
        | "stdout"
        | "stderr"
        | "status"
        | "approval_required"
        | "completed"
        | "failed"
        | "stopped";
      message: string;
      timestamp: string;
      data?: Record<string, unknown>;
    };

## Safety model

Voice input is untrusted.

Pipeline:

1. Receive transcript.
2. Normalize transcript.
3. Classify intent.
4. Convert to structured action.
5. Check safety rules.
6. Ask for approval if needed.
7. Execute only if safe or approved.
8. Stream logs.
9. Summarize result.
10. Speak result.

## Demo script

### Opening

User says:

“VoiceOps, start demo mode.”

App says:

“Demo mode ready. Say a coding task.”

### Feature command

User says:

“Create a landing page for a voice-controlled recipe app with a dark hero section and pricing cards.”

Expected app behavior:

- Shows transcript.
- Classifies as BUILD_FEATURE.
- Starts agent runner.
- Streams logs.
- Speaks: “I am building the landing page now.”

### Build command

User says:

“Run the build.”

Expected app behavior:

- Runs build workflow.
- Streams logs.
- Speaks success or failure.

### Fix command

User says:

“Fix the error.”

Expected app behavior:

- Sends error context to runner.
- Streams logs.
- Speaks fix summary.

### Summary command

User says:

“Read me what changed.”

Expected app behavior:

- Runs git diff summary.
- Speaks concise summary.

### Commit command

User says:

“Commit it as add voice recipe landing page.”

Expected app behavior:

- Detects commit intent.
- Creates approval prompt.
- Speaks: “Committing changes requires confirmation. Say confirm commit to continue.”

User says:

“Confirm commit.”

Expected app behavior:

- Creates local commit.
- Speaks: “Committed successfully.”

## UI copy

Idle:

“Say a coding task to begin.”

Listening:

“Listening...”

Thinking:

“Understanding command...”

Running:

“Agent is working...”

Approval needed:

“Approval required before continuing.”

Complete:

“Task complete.”

Failed:

“Task failed. Say ‘fix the error’ or ‘read the error.’”

## Final hackathon video message

The video should make one point:

“I built a tool that lets developers ship code without touching a keyboard.”

End with:

“Voice in. Cursor builds. ElevenLabs talks back. No keyboard.”