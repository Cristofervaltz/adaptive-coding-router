import crypto from 'node:crypto';
import { AgentProvider, AgentTask } from '../providers/AgentProvider';
import { CodexProvider } from '../providers/CodexProvider';
import { GeminiProvider } from '../providers/GeminiProvider';
import { AppDatabase } from '../storage/database';
import { RunEvent } from '../src/types';

export class ExecutionManager {
  private providers: Map<string, AgentProvider> = new Map();

  constructor(
    private db: AppDatabase,
    codexProvider: CodexProvider,
    geminiProvider: GeminiProvider
  ) {
    this.providers.set('codex', codexProvider);
    this.providers.set('gemini', geminiProvider);
  }

  public getProvider(id: string): AgentProvider | undefined {
    return this.providers.get(id);
  }

  public async executeRun(
    runId: string,
    task: AgentTask,
    providerId: 'codex' | 'gemini',
    timeoutMs: number,
    onEmitEvent: (event: RunEvent) => void
  ): Promise<{ exitCode: number; errorMessage?: string }> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not registered: ${providerId}`);
    }

    let errorMessage: string | undefined;

    const handleEvent = (event: { type: string; payload: string; timestamp: string }) => {
      const runEvent: RunEvent = {
        id: crypto.randomUUID(),
        runId,
        timestamp: event.timestamp,
        eventType: event.type as any,
        payload: event.payload,
      };

      // Persist in DB
      this.db.insertEvent({
        id: runEvent.id,
        run_id: runId,
        timestamp: runEvent.timestamp,
        event_type: runEvent.eventType,
        payload_json: JSON.stringify({ payload: runEvent.payload }),
      });

      // Stream to frontend
      onEmitEvent(runEvent);
    };

    try {
      const exitCode = await provider.execute(task, {
        runId,
        timeoutMs,
        onEvent: handleEvent,
      });

      return { exitCode };
    } catch (err: any) {
      errorMessage = err.message || 'Execution error';
      handleEvent({
        type: 'error',
        payload: errorMessage || 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      return { exitCode: 1, errorMessage };
    }
  }

  public async cancelRun(runId: string): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.cancel(runId);
    }
  }
}
