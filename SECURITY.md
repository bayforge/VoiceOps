# SECURITY.md

## Security philosophy

Cursor VoiceOps accepts voice input.

Voice input must be treated as untrusted.

The app must never execute raw transcribed speech.

## Required safety pipeline

1. Transcript received.
2. Transcript normalized.
3. Intent classified.
4. Structured action created.
5. Safety rules checked.
6. Approval requested if needed.
7. Command executed only if safe or approved.
8. Logs streamed.
9. Result summarized.

## Dangerous actions

Require explicit approval for:

- File deletion
- Git commit
- Git push
- Git reset
- Git clean
- Branch deletion
- Package installation
- Running arbitrary shell commands
- Commands outside repo root
- Environment file changes
- Credential file changes
- Any command containing `sudo`

## Approval phrases

Accepted confirmations:

- “confirm”
- “approve”
- “yes confirm”
- “confirm commit”
- “confirm branch”
- “confirm install”

Accepted rejections:

- “cancel”
- “reject”
- “no”
- “do not”
- “stop”

## Secret handling

Never log:

- API keys
- `.env` contents
- SSH keys
- tokens
- credentials
- cookies
- private certificates

## Default runner mode

Default to:

```env
AGENT_RUNNER_MODE=mock