import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export class AppDatabase {
  private db: DatabaseSync;

  constructor(dbDirectory: string) {
    if (!fs.existsSync(dbDirectory)) {
      fs.mkdirSync(dbDirectory, { recursive: true });
    }
    const dbPath = path.join(dbDirectory, 'acr.db');
    this.db = new DatabaseSync(dbPath);

    this.initPragmas();
    this.initTables();
  }

  private initPragmas(): void {
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        language TEXT,
        git_branch TEXT,
        test_command TEXT,
        build_command TEXT,
        lint_command TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL,
        assessment_json TEXT NOT NULL,
        current_run_id TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        reasoning_effort TEXT,
        status TEXT NOT NULL,
        attempt_number INTEGER NOT NULL DEFAULT 1,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        exit_code INTEGER,
        error_category TEXT,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS run_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS validation_results (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        check_type TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        summary TEXT NOT NULL,
        details TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ratings (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        feedback TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_runs_task ON runs(task_id);
      CREATE INDEX IF NOT EXISTS idx_run_events_run ON run_events(run_id);
    `);
  }

  // --- Projects ---
  upsertProject(project: {
    id: string;
    name: string;
    path: string;
    language: string;
    git_branch?: string;
    test_command?: string;
    build_command?: string;
    lint_command?: string;
    created_at: string;
    updated_at: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, language, git_branch, test_command, build_command, lint_command, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        language = excluded.language,
        git_branch = excluded.git_branch,
        test_command = excluded.test_command,
        build_command = excluded.build_command,
        lint_command = excluded.lint_command,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      project.id,
      project.name,
      project.path,
      project.language,
      project.git_branch ?? null,
      project.test_command ?? null,
      project.build_command ?? null,
      project.lint_command ?? null,
      project.created_at,
      project.updated_at
    );
  }

  getRecentProjects(): any[] {
    return this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 20').all();
  }

  getProjectById(id: string): any {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }

  getProjectByPath(projectPath: string): any {
    return this.db.prepare('SELECT * FROM projects WHERE path = ?').get(projectPath);
  }

  // --- Tasks ---
  createTask(task: {
    id: string;
    project_id: string;
    prompt: string;
    status: string;
    assessment_json: string;
    created_at: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, project_id, prompt, status, assessment_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(task.id, task.project_id, task.prompt, task.status, task.assessment_json, task.created_at);
  }

  updateTaskStatus(taskId: string, status: string, currentRunId?: string, completedAt?: string): void {
    let sql = 'UPDATE tasks SET status = ?';
    const params: (string | null)[] = [status];
    if (currentRunId !== undefined) {
      sql += ', current_run_id = ?';
      params.push(currentRunId);
    }
    if (completedAt !== undefined) {
      sql += ', completed_at = ?';
      params.push(completedAt);
    }
    sql += ' WHERE id = ?';
    params.push(taskId);

    this.db.prepare(sql).run(...params);
  }

  getTask(id: string): any {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  }

  listTasksForProject(projectId: string): any[] {
    return this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  }

  // --- Runs ---
  createRun(run: {
    id: string;
    task_id: string;
    provider: string;
    model: string;
    reasoning_effort?: string;
    status: string;
    attempt_number: number;
    started_at: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO runs (id, task_id, provider, model, reasoning_effort, status, attempt_number, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      run.id,
      run.task_id,
      run.provider,
      run.model,
      run.reasoning_effort ?? null,
      run.status,
      run.attempt_number,
      run.started_at
    );
  }

  updateRunEnd(runId: string, status: string, exitCode?: number, errorCategory?: string, errorMessage?: string, endedAt?: string): void {
    const stmt = this.db.prepare(`
      UPDATE runs SET
        status = ?,
        exit_code = ?,
        error_category = ?,
        error_message = ?,
        ended_at = ?
      WHERE id = ?
    `);
    stmt.run(
      status,
      exitCode ?? null,
      errorCategory ?? null,
      errorMessage ?? null,
      endedAt ?? new Date().toISOString(),
      runId
    );
  }

  getRunsForTask(taskId: string): any[] {
    return this.db.prepare('SELECT * FROM runs WHERE task_id = ? ORDER BY attempt_number ASC').all(taskId);
  }

  getRun(id: string): any {
    return this.db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
  }

  // --- Events ---
  insertEvent(event: {
    id: string;
    run_id: string;
    timestamp: string;
    event_type: string;
    payload_json: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO run_events (id, run_id, timestamp, event_type, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(event.id, event.run_id, event.timestamp, event.event_type, event.payload_json);
  }

  getEventsForRun(runId: string): any[] {
    return this.db.prepare('SELECT * FROM run_events WHERE run_id = ? ORDER BY timestamp ASC').all(runId);
  }

  // --- Validation ---
  insertValidationResult(result: {
    id: string;
    run_id: string;
    check_type: string;
    status: string;
    duration_ms: number;
    summary: string;
    details?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO validation_results (id, run_id, check_type, status, duration_ms, summary, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      result.id,
      result.run_id,
      result.check_type,
      result.status,
      result.duration_ms,
      result.summary,
      result.details ?? null
    );
  }

  getValidationResultsForRun(runId: string): any[] {
    return this.db.prepare('SELECT * FROM validation_results WHERE run_id = ?').all(runId);
  }

  // --- Ratings ---
  insertRating(id: string, taskId: string, score: number, feedback?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO ratings (id, task_id, score, feedback, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, taskId, score, feedback ?? null, new Date().toISOString());
  }

  getRatingForTask(taskId: string): any {
    return this.db.prepare('SELECT * FROM ratings WHERE task_id = ?').get(taskId);
  }

  // --- Settings ---
  getSetting<T>(key: string, defaultValue: T): T {
    const row = this.db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as { value_json: string } | undefined;
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value_json) as T;
    } catch {
      return defaultValue;
    }
  }

  setSetting(key: string, value: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value_json)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `);
    stmt.run(key, JSON.stringify(value));
  }

  // --- Statistics Queries ---
  getAllTasks(): any[] {
    return this.db.prepare('SELECT * FROM tasks').all();
  }

  getAllRuns(): any[] {
    return this.db.prepare('SELECT * FROM runs').all();
  }

  getAllValidations(): any[] {
    return this.db.prepare('SELECT * FROM validation_results').all();
  }
}
