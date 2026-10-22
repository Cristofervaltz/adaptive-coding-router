# Adaptive Coding Router (ACR)

Desktop application for automated routing, isolated execution, and validation of coding tasks across local AI CLI tools.

## Architecture

ACR coordinates four CLI agents on Windows:
* OpenAI Codex CLI (`codex.exe`)
* Google Antigravity CLI (`agy.exe`)
* Anthropic Claude Code CLI (`claude.cmd`)
* OpenCode CLI (`opencode.cmd`)

Each task runs in an isolated Git worktree created in `.git/acr-worktrees/<task-id>`. The application executes automated test and lint checks before changes are presented to the developer. No modifications reach the main working branch until the developer clicks Approve.

```
                  +---------------------------+
                  |  Developer Task Prompt    |
                  +-------------+-------------+
                                |
                                v
                  +---------------------------+
                  |  Task Analyzer (0 - 100)  |
                  +-------------+-------------+
                                |
                                v
                  +---------------------------+
                  |   Dynamic Model Router    |
                  |  (Quota / Tier Matching)  |
                  +-------------+-------------+
                                |
       +------------+-----------+-----------+------------+
       |            |                       |            |
       v            v                       v            v
  OpenAI Codex  Google Antigravity    Claude Code    OpenCode CLI
  (gpt-6.1-sol) (gemini-3.8-flash)   (claude-5-5-sonnet) (qwen2.5-coder)
       |            |                       |            |
       +------------+-----------+-----------+------------+
                                |
                                v
                  +---------------------------+
                  |    Git Worktree Sandbox   |
                  +-------------+-------------+
                                |
                                v
                  +---------------------------+
                  |    Validation Pipeline    |
                  |  (Diff, Tests, Linter)    |
                  +-------------+-------------+
                                |
                   +------------+------------+
                   |                         |
              Fail (Retry)              Pass (Review)
                   |                         |
                   v                         v
         Escalation Manager          Manual Merge Review
```

## Core Systems

### Dynamic Model Discovery and Tier Classification
ACR queries connected CLIs at startup (`agy models`, `opencode models`, Codex models cache). Models are assigned to four tiers:

| Tier | Complexity Range | Default Cost Weight | Example Models |
| :--- | :--- | :--- | :--- |
| `economy` | 0 - 34 | 0.4x | `gemini-3.8-flash-low`, `claude-5-5-haiku` |
| `standard` | 30 - 69 | 1.0x | `gemini-3.8-flash-medium`, `gpt-oss-120b`, `qwen2.5-coder` |
| `high_reasoning` | 65 - 89 | 2.0x | `gemini-3.8-flash-high`, `claude-5-5-sonnet`, `gpt-6.1-sol` |
| `ultra_expert` | 85 - 100 | 4.0x | `claude-5-5-opus-thinking`, `gpt-6-astra` |

### Quota Protection (Reserve OpenAI)
When Reserve OpenAI mode is active, the router adds a 10-point cost penalty to OpenAI models. Tasks with complexity below 70 are directed to alternative or local models (Google Antigravity, OpenCode), reserving OpenAI quota for tasks flagged as high complexity or architectural refactoring.

### Process Isolation and Execution
* Spawning: Child processes run via `node:child_process.spawn` with `cwd` set to the task's Git worktree.
* Termination: Process trees terminate on Windows using `tree-kill` (`taskkill /pid <pid> /T /F`).
* Worktree cleanup: Worktrees are removed automatically on task approval or rejection.

### Validation Pipeline
After a CLI process finishes with exit code 0, ACR runs five validation stages:
1. Diff verification: Checks that file modifications were generated and parses changed files.
2. Secret detection: Scans modified files for API keys and private tokens.
3. Test suite: Runs the project's configured test command (e.g. `npm test`, `pytest`).
4. Linter: Runs the project's linter (e.g. `npm run lint`, `ruff check`).
5. Build verification: Verifies the project builds cleanly.

If validation fails, the Escalation Manager captures the failure output and launches a retry with the next higher model tier.

### Storage
State persists in SQLite located in Electron's `userData` directory. Database pragmas:
* `journal_mode = WAL`
* `foreign_keys = ON`
* `synchronous = NORMAL`

## Installation and Setup

### Prerequisites
* Windows 10 or Windows 11
* Node.js 20+ (Node.js 24 supported)
* Git 2.30+ with worktree support enabled
* At least one supported CLI tool installed

### Setup Commands
```bash
git clone https://github.com/Cristofervaltz/adaptive-coding-router.git
cd adaptive-coding-router
npm install
npm run build
npm start
```

### CLI Path Resolution on Windows
ACR searches standard Windows directories automatically:
* OpenAI Codex: `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe`
* Google Antigravity: `%LOCALAPPDATA%\agy\bin\agy.exe`, `%APPDATA%\Antigravity\bin\agy-node.cmd`
* Claude Code: `%APPDATA%\npm\claude.cmd`, `%LOCALAPPDATA%\npm\claude.cmd`
* OpenCode: `%APPDATA%\npm\opencode.cmd`

Custom executable paths can be set in the Settings view.

## Technology Stack
* Shell: Electron 45.0.0
* Frontend: React 19.3.1, TypeScript 7.0.2, Tailwind CSS 4.3.3, Lucide React
* Bundler: Vite 8.3.5
* Database: Node.js SQLite (`node:sqlite`, DatabaseSync)
* Process Control: `tree-kill`
