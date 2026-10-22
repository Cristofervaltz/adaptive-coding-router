import React, { useState, useEffect, useCallback } from 'react';
import { Project, Task, RunEvent, ProviderStatus, SubscriptionSettings, ProviderQuota } from './types';
import { Navbar } from './components/Navbar';
import { QuotaBar } from './components/QuotaBar';
import { Dashboard } from './pages/Dashboard';
import { TaskDetails } from './pages/TaskDetails';
import { Statistics } from './pages/Statistics';
import { Settings } from './pages/Settings';
import { RefreshCw } from 'lucide-react';

const defaultSettings: SubscriptionSettings = {
  reserveOpenAI: true,
  openAIBudget: 100,
  openAIUsed: 0,
  openAIPlan: 'tier_500',
  claudePlan: 'claude_team_5_5',
  antigravityCreditsBudget: 100,
  antigravityCreditsUsed: 0,
  claudeGeneralUsed: 0,
  claudeFableUsed: 0,
  allowUltra: true,
  maxAttempts: 3,
  timeoutSeconds: 300,
  codexPath: 'codex',
  antigravityPath: 'agy',
  claudePath: 'claude',
  opencodePath: 'opencode',
  routingMode: 'auto',
  manualModel: 'gpt-6.1-sol',
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'stats' | 'settings'>('dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [quotas, setQuotas] = useState<ProviderQuota[]>([]);
  const [settings, setSettings] = useState<SubscriptionSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async (projectId: string) => {
    if (!window.acrApi) return;
    try {
      const taskList = await window.acrApi.listTasks(projectId);
      setTasks(taskList);
    } catch (err) {
      console.error('Failed to list tasks:', err);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!window.acrApi) {
      console.warn('ACR bridge not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [fetchedSettings, fetchedProviders, fetchedQuotas, recentProjects] = await Promise.all([
        window.acrApi.getSettings().catch(() => defaultSettings),
        window.acrApi.detectProviders().catch(() => []),
        window.acrApi.getProviderQuotas().catch(() => []),
        window.acrApi.getRecentProjects().catch(() => []),
      ]);

      if (fetchedSettings) setSettings(fetchedSettings);
      if (fetchedProviders) setProviders(fetchedProviders);
      if (fetchedQuotas) setQuotas(fetchedQuotas);

      if (recentProjects && recentProjects.length > 0) {
        const activeProj = recentProjects[0];
        setProject(activeProj);
        await loadTasks(activeProj.id);
      }
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  }, [loadTasks]);

  useEffect(() => {
    loadInitialData();

    if (!window.acrApi) return;

    // Listen for live CLI and validation events
    const unsubEvent = window.acrApi.onTaskEvent((event: RunEvent) => {
      setEvents((prev) => {
        // Keep a rolling buffer of 500 events
        const next = [...prev, event];
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    });

    // Listen for status changes
    const unsubStatus = window.acrApi.onTaskStatusChanged((data) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === data.taskId ? { ...t, status: data.status } : t))
      );
      // Refresh live quota balances when a task completes or updates
      window.acrApi.getProviderQuotas().then(setQuotas).catch(() => {});
    });

    return () => {
      unsubEvent();
      unsubStatus();
    };
  }, [loadInitialData]);

  const handleOpenProject = async () => {
    try {
      const selected = await window.acrApi.selectProjectDirectory();
      if (selected) {
        setProject(selected);
        setSelectedTaskId(null);
        await loadTasks(selected.id);
      }
    } catch (err) {
      console.error('Failed to open project:', err);
    }
  };

  const handleRefreshProviders = async () => {
    try {
      const [status, quotaList] = await Promise.all([
        window.acrApi.detectProviders(),
        window.acrApi.getProviderQuotas(),
      ]);
      setProviders(status);
      setQuotas(quotaList);
    } catch (err) {
      console.error('Failed to refresh providers:', err);
    }
  };

  const handleCreateTask = async (prompt: string, manualModel?: string) => {
    if (!project) return;
    try {
      const created = await window.acrApi.createTask(project.id, prompt, manualModel);
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      console.error('Failed to dispatch task:', err);
    }
  };

  const refreshSettings = async () => {
    const [s, quotaList] = await Promise.all([
      window.acrApi.getSettings(),
      window.acrApi.getProviderQuotas(),
    ]);
    setSettings(s);
    setQuotas(quotaList);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-xs">Initializing Adaptive Coding Router...</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSelectedTaskId(null);
        }}
        project={project}
        onOpenProject={handleOpenProject}
        providers={providers}
        onRefreshProviders={handleRefreshProviders}
      />

      <QuotaBar quotas={quotas} onRefresh={handleRefreshProviders} />

      <main className="flex-1 flex overflow-hidden">
        {selectedTaskId ? (
          <TaskDetails taskId={selectedTaskId} onBack={() => setSelectedTaskId(null)} />
        ) : currentTab === 'dashboard' ? (
          <Dashboard
            project={project}
            onOpenProject={handleOpenProject}
            tasks={tasks}
            onSelectTask={(id) => setSelectedTaskId(id)}
            onCreateTask={handleCreateTask}
            events={events}
            settings={settings}
            providers={providers}
          />
        ) : currentTab === 'stats' ? (
          <Statistics />
        ) : (
          <Settings onSettingsSaved={refreshSettings} providers={providers} />
        )}
      </main>
    </div>
  );
};
