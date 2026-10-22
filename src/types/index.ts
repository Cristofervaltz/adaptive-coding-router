export type TaskCategory =
  | 'simple_code'
  | 'complex_code'
  | 'architecture'
  | 'debugging'
  | 'asset_generation'
  | 'animation'
  | 'visual_design'
  | 'refactoring'
  | 'documentation';

export type TaskStatus =
  | 'queued'
  | 'analyzing'
  | 'running'
  | 'validating'
  | 'retrying'
  | 'escalating'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Project {
  id: string;
  name: string;
  path: string;
  language: string;
  gitBranch?: string;
  hasUncommitted?: boolean;
  testCommand?: string;
  buildCommand?: string;
  lintCommand?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssessment {
  category: TaskCategory;
  complexity: number; // 0 - 100
  risk: number; // 0 - 100
  confidence: number; // 0 - 1
  estimatedFiles: number;
  requiresArchitecture: boolean;
  preferredCapabilities: string[];
  reasoning: string;
}

export interface Task {
  id: string;
  projectId: string;
  prompt: string;
  status: TaskStatus;
  assessment: TaskAssessment;
  createdAt: string;
  completedAt?: string;
  currentRunId?: string;
  rating?: number;
}

export interface Run {
  id: string;
  taskId: string;
  provider: 'codex' | 'gemini' | 'mock';
  model: string;
  reasoningEffort?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  errorCategory?: string;
  errorMessage?: string;
  attemptNumber: number;
}

export interface RunEvent {
  id: string;
  runId: string;
  timestamp: string;
  eventType: 'stdout' | 'stderr' | 'status' | 'validation' | 'error';
  payload: string;
}

export type ValidationCheckType = 'diff' | 'test' | 'lint' | 'build' | 'secrets';

export interface ValidationResult {
  id: string;
  runId: string;
  checkType: ValidationCheckType;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  durationMs: number;
  summary: string;
  details?: string;
}

export interface ProviderCapabilities {
  models: string[];
  supportsReasoning: boolean;
  supportsStreaming: boolean;
  authStatus: boolean;
  version?: string;
  path?: string;
}

export interface ProviderStatus {
  id: 'codex' | 'gemini';
  name: string;
  installed: boolean;
  version?: string;
  authenticated: boolean;
  availableModels: string[];
  activeAccount?: string;
  error?: string;
}

export interface SubscriptionSettings {
  reserveOpenAI: boolean;
  openAIBudget: number;
  openAIUsed: number;
  allowUltra: boolean;
  maxAttempts: number;
  timeoutSeconds: number;
  codexPath: string;
  geminiPath: string;
  routingMode: 'auto' | 'manual';
  manualModel: string;
}

export interface StatisticsOverview {
  totalTasks: number;
  firstPassSuccessRate: number;
  validatedCompletionRate: number;
  escalationRate: number;
  medianDurationSec: number;
  attemptsPerTask: number;
  providerUsage: {
    google: number;
    openai: number;
  };
  ultraUsage: number;
  categorySuccess: Record<string, { total: number; passed: number }>;
}

export interface GitDiffFile {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  diff: string;
}

export interface GitDiffSummary {
  files: GitDiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  rawDiff: string;
}

export interface ACRPlatformApi {
  // Projects
  selectProjectDirectory: () => Promise<Project | null>;
  getRecentProjects: () => Promise<Project[]>;
  getProjectDetails: (projectId: string) => Promise<Project | null>;

  // Providers
  getProvidersStatus: () => Promise<ProviderStatus[]>;
  detectProviders: () => Promise<ProviderStatus[]>;

  // Tasks
  createTask: (projectId: string, prompt: string, manualModel?: string) => Promise<Task>;
  listTasks: (projectId: string) => Promise<Task[]>;
  getTaskDetails: (taskId: string) => Promise<{
    task: Task;
    runs: Run[];
    events: RunEvent[];
    validations: ValidationResult[];
    diff: GitDiffSummary | null;
  } | null>;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  approveTask: (taskId: string) => Promise<void>;
  rejectTask: (taskId: string) => Promise<void>;
  rateTask: (taskId: string, rating: number, feedback?: string) => Promise<void>;

  // Settings
  getSettings: () => Promise<SubscriptionSettings>;
  saveSettings: (settings: Partial<SubscriptionSettings>) => Promise<SubscriptionSettings>;

  // Statistics
  getStatistics: () => Promise<StatisticsOverview>;

  // Events subscriptions
  onTaskEvent: (callback: (event: RunEvent) => void) => () => void;
  onTaskStatusChanged: (callback: (data: { taskId: string; status: TaskStatus }) => void) => () => void;
}

declare global {
  interface Window {
    acrApi: ACRPlatformApi;
  }
}
