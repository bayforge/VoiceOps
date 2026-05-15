# UI_STYLE_INTENT.md

## Direction

The UI should feel like a premium AI-native voice development studio.

The product is not a generic chatbot. It is a hands-free development cockpit where voice commands drive an agentic software-building workflow.

## Visual style

- Dark-mode-first
- Glassmorphism
- Translucent panels
- Backdrop blur
- Soft borders
- Layered cards
- Subtle gradients
- Radial glows
- Rounded 2xl and 3xl corners
- Spacious layout
- Strong typography
- Violet, cyan, electric blue, soft white, and muted slate accents

## UX priorities

The user should always understand:

1. What the app is listening to
2. What command was understood
3. What the agent is doing
4. What output is being produced
5. What the user can say next
6. Whether approval is required

## Core surfaces

- Voice input surface
- Conversation/transcript surface
- Agent workflow timeline
- Terminal/log panel
- App/code output preview
- Approval prompt panel
- Onboarding guidance

## Reusable components

Use these only where helpful:

- GlassPanel
- VoiceOrb
- VoiceVisualizer
- AgentStatus
- WorkflowStep
- ConversationMessage
- OnboardingCard
- FloatingActionInput

## Avoid

- Static mockup replacement
- Fake data when real state exists
- Generic chatbot layout
- Neon overload
- Excessive animation
- Heavy dependencies
- Broken accessibility
- Changed backend contracts