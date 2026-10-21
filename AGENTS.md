# Adaptive Coding Router (ACR) — Agent Guidelines & Rules

## 1. Core Mission & Technical Constraints
- Follow the **MVP v1.2 Technical Specification** strictly.
- Stack: Electron, React, TypeScript, Node.js, SQLite.
- AI Integrations: Codex CLI and Gemini CLI via local process spawning (`child_process.spawn`).
- Change isolation: Git worktrees. Never modify user repositories directly without confirmation.
- Subscription-awareness: Treat OpenAI models as sharing quota. Support Reserve OpenAI mode.

## 2. No AI Slop & Style Rules
- **No Em-dashes (`—`):** Banned. Use commas, parentheses, colons, or split sentences.
- **No Intensifiers or Hollow Praise:** Never write "revolutionary", "significantly", "robust", "cutting-edge", "game-changing". Use numbers and concrete metrics instead.
- **Direct, factual descriptions:** Open directly with what the code or feature does.
- **No Repetitive 3-item Lists:** Avoid symmetrical tripartite structures created just to sound polished.
- **No Chatbot Artifacts:** Strip prompt tags, weird emojis in every header, and rhetorical questions at the end of outputs.

## 3. UI/UX Principles
- Dark mode native feel inspired by modern developer tools (Vercel, Linear, Raycast).
- Color palette: neutral slate/zinc base, high-contrast crisp text, purposeful accent colors for status states (green for completed, amber for awaiting approval, red for failed, blue for running).
- High density without clutter: clean tables, clear metrics, monospaced logs with search and virtual scrolling.
- Real-time updates: streaming logs and live status transitions.

## 4. Engineering Standards
- Strict TypeScript types (`strict: true`), no arbitrary `any`.
- Safe IPC: preload script with `contextBridge`, strictly defined type contracts for channels.
- Reliable process termination on Windows: kill process tree on cancel/timeout (`taskkill /pid <pid> /T /F` or `tree-kill`).
- SQLite in WAL mode with prepared statements.
