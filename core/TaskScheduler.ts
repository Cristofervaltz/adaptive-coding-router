import crypto from 'node:crypto';
import {
  Task,
  TaskStatus,
  RunEvent,
  Project,
  GitDiffSummary,
} from '../src/types';
import { AppDatabase } from '../storage/database';
import { TaskAnalyzer } from './TaskAnalyzer';
import { ModelRouter } from './ModelRouter';
import { ExecutionManager } from './ExecutionManager';
import { GitManager } from '../workspace/GitManager';
import { Validator } from './Validator';
import { EscalationManager } from './EscalationManager';
import { SubscriptionManager } from './SubscriptionManager';

export interface TaskLifecycleEmitter {
  emitEvent: (event: RunEvent) => void;
  emitStatus: (taskId: string, status: TaskStatus) => void;
}

export class TaskScheduler {
  private activeTasks: Map<string, { runId: string; worktreePath?: string }> = new Map();
  private projectActiveLocks: Set<string> = new Set(); // MVP: Single active agent per project

  constructor(
    private db: AppDatabase,
    private analyzer: TaskAnalyzer,
    private router: ModelRouter,
    private executionManager: ExecutionManager,
    private gitManager: GitManager,
    private validator: Validator,
    private escalationManager: EscalationManager,
    private subscriptionManager: SubscriptionManager,
    private emitter: TaskLifecycleEmitter
  ) {
    this.recoverInterruptedTasks();
  }

  private recoverInterruptedTasks(): void {
    const allTasks = this.db.getAllTasks();
    for (const t of allTasks) {
      if (['analyzing', 'running', 'validating', 'escalating', 'retrying'].includes(t.status)) {
        this.db.updateTaskStatus(t.id, 'failed', undefined, new Date().toISOString());
      }
    }
  }

  public async createTask(
    project: Project,
    prompt: string,
    manualModel?: string
  ): Promise<Task> {
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Analyze Task
    const assessment = this.analyzer.analyze(prompt, !!project.testCommand);

    const task: Task = {
      id: taskId,
      projectId: project.id,
      prompt,
      status: 'queued',
      assessment,
      createdAt: now,
    };

    this.db.createTask({
      id: task.id,
      project_id: task.projectId,
      prompt: task.prompt,
      status: task.status,
      assessment_json: JSON.stringify(task.assessment),
      created_at: task.createdAt,
    });

    this.emitter.emitStatus(task.id, 'queued');

    // Trigger execution asynchronously
    setTimeout(() => {
      this.processTask(task, project, manualModel).catch((err) => {
        console.error(`Task execution failed: ${err.message}`);
      });
    }, 100);

    return task;
  }

  private async processTask(
    task: Task,
    project: Project,
    manualModel?: string
  ): Promise<void> {
    if (this.projectActiveLocks.has(project.id)) {
      this.updateStatus(task.id, 'queued');
      // Retry in 3 seconds if project has another active agent
      setTimeout(() => this.processTask(task, project, manualModel), 3000);
      return;
    }

    this.projectActiveLocks.add(project.id);

    try {
      this.updateStatus(task.id, 'analyzing');

      let attempt = 1;
      let diagnosticContext = '';
      let ultraAttempts = 0;
      let finalSuccess = false;
      let worktreePath: string | undefined;

      // 1. Create Isolated Worktree
      worktreePath = await this.gitManager.createWorktree(project.path, task.id);

      while (attempt <= this.subscriptionManager.getSettings().maxAttempts && !finalSuccess) {
        // Route model dynamically based on live provider statuses
        const availableProviders = await this.executionManager.getAvailableProviderStatuses();
        const route = this.router.route(task.assessment, availableProviders, manualModel);
        if (route.model.includes('Ultra')) {
          ultraAttempts += 1;
        }

        const runId = crypto.randomUUID();
        const runStartedAt = new Date().toISOString();

        this.db.createRun({
          id: runId,
          task_id: task.id,
          provider: route.provider,
          model: route.model,
          reasoning_effort: route.reasoningEffort,
          status: 'running',
          attempt_number: attempt,
          started_at: runStartedAt,
        });

        this.activeTasks.set(task.id, { runId, worktreePath });
        this.updateStatus(task.id, 'running', runId);

        // Record usage for subscription tracking
        this.subscriptionManager.recordUsage(route.model, 1, route.provider);

        // Execute via ExecutionManager
        const { exitCode, errorMessage } = await this.executionManager.executeRun(
          runId,
          {
            id: task.id,
            prompt: task.prompt,
            model: route.model,
            reasoningEffort: route.reasoningEffort,
            workspacePath: worktreePath,
            diagnosticContext: diagnosticContext || undefined,
          },
          route.provider,
          this.subscriptionManager.getSettings().timeoutSeconds * 1000,
          (event) => this.emitter.emitEvent(event)
        );

        // 2. Validation Stage
        this.updateStatus(task.id, 'validating', runId);
        const diff = await this.gitManager.getDiff(project.path, worktreePath);

        const validations = await this.validator.validateRun(runId, worktreePath, project, diff);

        for (const v of validations) {
          this.db.insertValidationResult({
            id: v.id,
            run_id: v.runId,
            check_type: v.checkType,
            status: v.status,
            duration_ms: v.durationMs,
            summary: v.summary,
            details: v.details,
          });
        }

        const hasValidationFailure = validations.some((v) => v.status === 'failed');
        const isRunSuccessful = exitCode === 0 && !hasValidationFailure;

        if (isRunSuccessful) {
          finalSuccess = true;
          this.db.updateRunEnd(runId, 'completed', exitCode, undefined, undefined, new Date().toISOString());
          this.updateStatus(task.id, 'awaiting_approval', runId);
          break;
        }

        // 3. Handle Failure and Escalation
        const errorCategory = this.escalationManager.classifyError(exitCode, errorMessage || '', validations);
        this.db.updateRunEnd(runId, 'failed', exitCode, errorCategory, errorMessage, new Date().toISOString());

        const escalation = this.escalationManager.evaluateEscalation(
          attempt,
          route.model,
          task.assessment.category,
          errorCategory,
          validations,
          this.subscriptionManager.getSettings(),
          ultraAttempts
        );

        if (escalation.canEscalate) {
          attempt += 1;
          diagnosticContext = escalation.diagnosticContext;
          this.updateStatus(task.id, 'escalating', runId);

          this.emitter.emitEvent({
            id: crypto.randomUUID(),
            runId,
            timestamp: new Date().toISOString(),
            eventType: 'status',
            payload: `[EscalationManager] ${escalation.reason}`,
          });

          // Short cooldown before next attempt
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          this.updateStatus(task.id, 'failed', runId, new Date().toISOString());
          this.emitter.emitEvent({
            id: crypto.randomUUID(),
            runId,
            timestamp: new Date().toISOString(),
            eventType: 'error',
            payload: `[Escalation halted]: ${escalation.reason}`,
          });
          break;
        }
      }
    } catch (err: any) {
      this.updateStatus(task.id, 'failed', undefined, new Date().toISOString());
    } finally {
      this.projectActiveLocks.delete(project.id);
    }
  }

  public async approveTask(task: Task, project: Project): Promise<void> {
    const activeInfo = this.activeTasks.get(task.id);
    const worktreePath = activeInfo?.worktreePath || `${project.path}/.acr-worktrees/task-${task.id.slice(0, 8)}`;
    await this.gitManager.applyMerge(project.path, worktreePath, task.id);
    this.updateStatus(task.id, 'completed', undefined, new Date().toISOString());
    this.activeTasks.delete(task.id);
  }

  public async rejectTask(task: Task, project: Project): Promise<void> {
    const activeInfo = this.activeTasks.get(task.id);
    const worktreePath = activeInfo?.worktreePath || `${project.path}/.acr-worktrees/task-${task.id.slice(0, 8)}`;
    await this.gitManager.discardWorktree(project.path, worktreePath, task.id);
    this.updateStatus(task.id, 'cancelled', undefined, new Date().toISOString());
    this.activeTasks.delete(task.id);
  }

  public async cancelTask(taskId: string): Promise<void> {
    const active = this.activeTasks.get(taskId);
    if (active) {
      await this.executionManager.cancelRun(active.runId);
    }
    this.updateStatus(taskId, 'cancelled', undefined, new Date().toISOString());
    this.activeTasks.delete(taskId);
  }

  public async getTaskDiff(task: Task, project: Project): Promise<GitDiffSummary | null> {
    const activeInfo = this.activeTasks.get(task.id);
    const worktreePath = activeInfo?.worktreePath || `${project.path}/.acr-worktrees/task-${task.id.slice(0, 8)}`;
    return this.gitManager.getDiff(project.path, worktreePath);
  }

  private updateStatus(taskId: string, status: TaskStatus, currentRunId?: string, completedAt?: string): void {
    this.db.updateTaskStatus(taskId, status, currentRunId, completedAt);
    this.emitter.emitStatus(taskId, status);
  }
}
