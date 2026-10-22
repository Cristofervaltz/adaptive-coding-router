import { contextBridge, ipcRenderer } from 'electron';
import { ACRPlatformApi, RunEvent, TaskStatus } from '../src/types';

const api: ACRPlatformApi = {
  selectProjectDirectory: () => ipcRenderer.invoke('projects:select'),
  getRecentProjects: () => ipcRenderer.invoke('projects:getRecent'),
  getProjectDetails: (id: string) => ipcRenderer.invoke('projects:getDetails', id),

  getProvidersStatus: () => ipcRenderer.invoke('providers:getStatus'),
  detectProviders: () => ipcRenderer.invoke('providers:detect'),

  createTask: (projectId: string, prompt: string, manualModel?: string) =>
    ipcRenderer.invoke('tasks:create', projectId, prompt, manualModel),
  listTasks: (projectId: string) => ipcRenderer.invoke('tasks:list', projectId),
  getTaskDetails: (taskId: string) => ipcRenderer.invoke('tasks:getDetails', taskId),
  cancelTask: (taskId: string) => ipcRenderer.invoke('tasks:cancel', taskId),
  retryTask: (taskId: string) => ipcRenderer.invoke('tasks:retry', taskId),
  approveTask: (taskId: string) => ipcRenderer.invoke('tasks:approve', taskId),
  rejectTask: (taskId: string) => ipcRenderer.invoke('tasks:reject', taskId),
  rateTask: (taskId: string, rating: number, feedback?: string) =>
    ipcRenderer.invoke('tasks:rate', taskId, rating, feedback),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  getStatistics: () => ipcRenderer.invoke('stats:getOverview'),

  onTaskEvent: (callback: (event: RunEvent) => void) => {
    const subscription = (_event: any, data: RunEvent) => callback(data);
    ipcRenderer.on('task:event', subscription);
    return () => {
      ipcRenderer.removeListener('task:event', subscription);
    };
  },

  onTaskStatusChanged: (callback: (data: { taskId: string; status: TaskStatus }) => void) => {
    const subscription = (_event: any, data: { taskId: string; status: TaskStatus }) => callback(data);
    ipcRenderer.on('task:status-changed', subscription);
    return () => {
      ipcRenderer.removeListener('task:status-changed', subscription);
    };
  },
};

contextBridge.exposeInMainWorld('acrApi', api);
