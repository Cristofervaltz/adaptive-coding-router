import { ProviderCapabilities } from '../src/types';

export interface AgentTask {
  id: string;
  prompt: string;
  model: string;
  reasoningEffort?: string;
  workspacePath: string;
  diagnosticContext?: string; // Passed on escalation from previous failed run
}

export interface ExecutionContext {
  runId: string;
  timeoutMs: number;
  onEvent: (event: AgentEvent) => void;
}

export interface AgentEvent {
  type: 'stdout' | 'stderr' | 'status' | 'completed' | 'error';
  payload: string;
  timestamp: string;
}

export interface AgentProvider {
  id: string;
  name: string;
  detect(): Promise<boolean>;
  getCapabilities(): Promise<ProviderCapabilities>;
  execute(task: AgentTask, context: ExecutionContext): Promise<number>; // returns exit code
  cancel(runId: string): Promise<void>;
}
