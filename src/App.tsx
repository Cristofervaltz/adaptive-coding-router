import React, { useState, useEffect, useCallback } from 'react';
import { Project, Task, RunEvent, ProviderStatus, SubscriptionSettings } from './types';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { TaskDetails } from './pages/TaskDetails';
import { Statistics } from './pages/Statistics';
import { Settings } from './pages/Settings';
import { RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'stats' | 'settings'>('dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async (projectId: string) => {
    try {
      const taskList = await window.acrApi.listTasks(projectId);
      setTasks(taskList);
    } catch (err) {
      console.error('Failed to list tasks:', err);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedSettings, fetchedProviders, recentProjects] = await Promise.all([
        window.acrApi.getSettings(),
        window.acrApi.detectProviders(),
        window.acrApi.getRecentProjects(),
      ]);

      setSettings(fetchedSettings);
      setProviders(fetchedProviders);

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
      const status = await window.acrApi.detectProviders();
      setProviders(status);
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
    const s = await window.acrApi.getSettings();
    setSettings(s);
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
            settings={settings!}
          />
        ) : currentTab === 'stats' ? (
          <Statistics />
        ) : (
          <Settings onSettingsSaved={refreshSettings} />
        )}
      </main>
    </div>
  );
};
