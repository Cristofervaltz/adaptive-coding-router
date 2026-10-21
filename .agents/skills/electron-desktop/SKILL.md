---
name: electron-desktop
description: "Best practices and architectural patterns for building secure, high-performance Electron desktop applications with React, TypeScript, SQLite, and child process management."
---

# Electron Desktop Architecture & Implementation Guide

Use this skill when developing, structuring, and hardening desktop applications built with Electron, React, TypeScript, and Node.js.

## 1. Security & Process Architecture

### 1.1. Context Isolation & IPC
- **Never enable `nodeIntegration: true`** in renderer processes.
- **Always keep `contextIsolation: true`** and `sandbox: false` (when Node APIs are needed via preload).
- Expose strictly typed APIs via `contextBridge.exposeInMainWorld('acrApi', { ... })`.
- Validate all arguments received in `ipcMain.handle` / `ipcMain.on` before executing backend operations.
- Use `ipcMain.handle` with `ipcRenderer.invoke` for request-response communication (promises).
- Use `event.sender.send` with `ipcRenderer.on` for streaming real-time events (CLI logs, task state updates).

### 1.2. Process Lifecycle & Window Management
- Persist window size and position in SQLite or app config.
- Handle graceful shutdown: abort running processes, release Git worktrees, close SQLite connections on `app.on('before-quit')`.
- Clean error boundaries in React to prevent blank white screens if a component throws.

## 2. Child Process Management (CLI & Shell)

### 2.1. Process Spawning & Streaming
- Use `child_process.spawn` instead of `exec` to stream real-time output and prevent memory buffer exhaustion.
- Stream chunks line-by-line using readline or custom chunk splitter.
- Mask sensitive environment variables and credentials before logging or emitting to the frontend.

### 2.2. Windows Sub-process Termination (Tree-Kill)
- On Windows, terminating a parent process via `process.kill()` often leaves child processes running.
- Use `tree-kill` or `taskkill /pid <pid> /T /F` to reliably tear down CLI child trees upon cancellation, timeout, or application exit.

## 3. SQLite Storage in Electron

### 3.1. Database Location & Initialization
- Store SQLite database inside `app.getPath('userData')` (e.g., `AppData/Roaming/AdaptiveCodingRouter/acr.db`), never inside the read-only application bundle.
- Enable Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) for high concurrency and fast writes.
- Use foreign keys (`PRAGMA foreign_keys = ON;`).
- Implement schema versioning / migration runner on app startup.

## 4. Git Worktree Isolation

- Create dedicated ephemeral worktrees: `git worktree add -b acr/task-<id> <worktree-path> HEAD`.
- Run CLI modifications strictly inside `<worktree-path>`.
- After completion or cancellation:
  - If rejected or cancelled: remove worktree (`git worktree remove --force <worktree-path>`) and prune.
  - If approved: perform clean merge into target branch, then remove worktree.
- Always check for existing locks or lingering worktrees on application startup and clean them up.

## 5. UI/UX & No-AI-Slop Rules

- Professional developer tool aesthetics: Dark mode native feel, subtle border radiuses, clean borders (`zinc-800`), monospaced code blocks.
- Virtualized list for logs to handle 10,000+ lines without UI lag.
- Plain, factual language for all UI copy (no buzzwords, no vague labels, concrete numbers and statuses).
