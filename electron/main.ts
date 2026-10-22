import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { AppDatabase } from '../storage/database';
import { ProjectManager } from '../core/ProjectManager';
import { SubscriptionManager } from '../core/SubscriptionManager';
import { CodexProvider } from '../providers/CodexProvider';
import { AntigravityProvider } from '../providers/AntigravityProvider';
import { ClaudeProvider } from '../providers/ClaudeProvider';
import { OpenCodeProvider } from '../providers/OpenCodeProvider';
import { ExecutionManager } from '../core/ExecutionManager';
import { TaskAnalyzer } from '../core/TaskAnalyzer';
import { ModelRouter } from '../core/ModelRouter';
import { GitManager } from '../workspace/GitManager';
import { Validator } from '../core/Validator';
import { EscalationManager } from '../core/EscalationManager';
import { StatisticsService } from '../core/StatisticsService';
import { TaskScheduler } from '../core/TaskScheduler';
import { ProviderStatus, RunEvent, TaskStatus } from '../src/types';

let mainWindow: BrowserWindow | null = null;

// Initialize Core Services
const userDataPath = app.getPath('userData');
const db = new AppDatabase(userDataPath);
const projectManager = new ProjectManager(db);
const subscriptionManager = new SubscriptionManager(db);

const codexProvider = new CodexProvider(subscriptionManager.getSettings().codexPath);
const antigravityProvider = new AntigravityProvider(subscriptionManager.getSettings().antigravityPath);
const claudeProvider = new ClaudeProvider(subscriptionManager.getSettings().claudePath);
const opencodeProvider = new OpenCodeProvider(subscriptionManager.getSettings().opencodePath);
const executionManager = new ExecutionManager(
  db,
  codexProvider,
  antigravityProvider,
  claudeProvider,
  opencodeProvider
);

const taskAnalyzer = new TaskAnalyzer();
const modelRouter = new ModelRouter(subscriptionManager);
const gitManager = new GitManager();
const validator = new Validator();
const escalationManager = new EscalationManager();
const statisticsService = new StatisticsService(db);

const taskScheduler = new TaskScheduler(
  db,
  taskAnalyzer,
  modelRouter,
  executionManager,
  gitManager,
  validator,
  escalationManager,
  subscriptionManager,
  {
    emitEvent: (event: RunEvent) => {
      mainWindow?.webContents.send('task:event', event);
    },
    emitStatus: (taskId: string, status: TaskStatus) => {
      mainWindow?.webContents.send('task:status-changed', { taskId, status });
    },
  }
);

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#09090b',
    title: 'Adaptive Coding Router',
    titleBarStyle: 'default',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    const loadDev = (retries = 15, delay = 400) => {
      mainWindow?.loadURL(devUrl).catch((err) => {
        if (retries > 0) {
          setTimeout(() => loadDev(retries - 1, delay), delay);
        } else {
          console.error('[Electron] Dev server unreachable, falling back to dist/index.html', err);
          mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
        }
      });
    };
    loadDev();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Register IPC Handlers
function registerIpcHandlers(): void {
  // Projects
  ipcMain.handle('projects:select', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Directory',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    return projectManager.scanProject(folderPath);
  });

  ipcMain.handle('projects:getRecent', async () => {
    return projectManager.getRecentProjects();
  });

  ipcMain.handle('projects:getDetails', async (_event, id: string) => {
    return projectManager.getProject(id);
  });

  // Providers
  const detectProvidersInternal = async (): Promise<ProviderStatus[]> => {
    return executionManager.getAvailableProviderStatuses();
  };

  ipcMain.handle('providers:getStatus', async () => {
    return detectProvidersInternal();
  });

  ipcMain.handle('providers:detect', async () => {
    return detectProvidersInternal();
  });

  // Tasks
  ipcMain.handle('tasks:create', async (_event, projectId: string, prompt: string, manualModel?: string) => {
    const project = projectManager.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    return taskScheduler.createTask(project, prompt, manualModel);
  });

  ipcMain.handle('tasks:list', async (_event, projectId: string) => {
    const rows = db.listTasksForProject(projectId);
    return rows.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      prompt: r.prompt,
      status: r.status,
      assessment: JSON.parse(r.assessment_json || '{}'),
      createdAt: r.created_at,
      completedAt: r.completed_at || undefined,
      currentRunId: r.current_run_id || undefined,
    }));
  });

  ipcMain.handle('tasks:getDetails', async (_event, taskId: string) => {
    const taskRow = db.getTask(taskId);
    if (!taskRow) return null;

    const task = {
      id: taskRow.id,
      projectId: taskRow.project_id,
      prompt: taskRow.prompt,
      status: taskRow.status,
      assessment: JSON.parse(taskRow.assessment_json || '{}'),
      createdAt: taskRow.created_at,
      completedAt: taskRow.completed_at || undefined,
      currentRunId: taskRow.current_run_id || undefined,
    };

    const project = projectManager.getProject(task.projectId);
    const runs = db.getRunsForTask(taskId);

    let allEvents: any[] = [];
    let allValidations: any[] = [];

    for (const r of runs) {
      const evs = db.getEventsForRun(r.id);
      allEvents = allEvents.concat(evs.map((e: any) => ({
        id: e.id,
        runId: e.run_id,
        timestamp: e.timestamp,
        eventType: e.event_type,
        payload: JSON.parse(e.payload_json || '{}').payload || '',
      })));

      const vals = db.getValidationResultsForRun(r.id);
      allValidations = allValidations.concat(vals.map((v: any) => ({
        id: v.id,
        runId: v.run_id,
        checkType: v.check_type,
        status: v.status,
        durationMs: v.duration_ms,
        summary: v.summary,
        details: v.details || undefined,
      })));
    }

    let diff = null;
    if (project) {
      diff = await taskScheduler.getTaskDiff(task as any, project);
    }

    return {
      task,
      runs,
      events: allEvents,
      validations: allValidations,
      diff,
    };
  });

  ipcMain.handle('tasks:cancel', async (_event, taskId: string) => {
    return taskScheduler.cancelTask(taskId);
  });

  ipcMain.handle('tasks:retry', async (_event, taskId: string) => {
    const taskRow = db.getTask(taskId);
    if (!taskRow) return;
    const project = projectManager.getProject(taskRow.project_id);
    if (!project) return;
    await taskScheduler.createTask(project, taskRow.prompt);
  });

  ipcMain.handle('tasks:approve', async (_event, taskId: string) => {
    const taskRow = db.getTask(taskId);
    if (!taskRow) return;
    const project = projectManager.getProject(taskRow.project_id);
    if (!project) return;
    return taskScheduler.approveTask(taskRow as any, project);
  });

  ipcMain.handle('tasks:reject', async (_event, taskId: string) => {
    const taskRow = db.getTask(taskId);
    if (!taskRow) return;
    const project = projectManager.getProject(taskRow.project_id);
    if (!project) return;
    return taskScheduler.rejectTask(taskRow as any, project);
  });

  ipcMain.handle('tasks:rate', async (_event, taskId: string, rating: number, feedback?: string) => {
    statisticsService.recordRating(taskId, rating, feedback);
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return subscriptionManager.getSettings();
  });

  ipcMain.handle('settings:save', async (_event, updatedSettings) => {
    const saved = subscriptionManager.updateSettings(updatedSettings);
    if (saved.codexPath) codexProvider.setCliPath(saved.codexPath);
    if (saved.antigravityPath) antigravityProvider.setCliPath(saved.antigravityPath);
    if (saved.claudePath) claudeProvider.setCliPath(saved.claudePath);
    if (saved.opencodePath) opencodeProvider.setCliPath(saved.opencodePath);
    return saved;
  });

  // Statistics
  ipcMain.handle('stats:getOverview', async () => {
    return statisticsService.getOverview();
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
