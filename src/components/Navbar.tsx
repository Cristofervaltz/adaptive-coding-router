import React from 'react';
import { Project, ProviderStatus } from '../types';
import { Folder, GitBranch, LayoutDashboard, BarChart3, Settings as SettingsIcon, Cpu, RefreshCw } from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'stats' | 'settings';
  onSelectTab: (tab: 'dashboard' | 'stats' | 'settings') => void;
  project: Project | null;
  onOpenProject: () => void;
  providers: ProviderStatus[];
  onRefreshProviders: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  project,
  onOpenProject,
  providers,
  onRefreshProviders,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 text-sm select-none">
      {/* Brand & Project */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
            A
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight">Adaptive Coding Router</span>
        </div>

        {/* Project Selector Chip */}
        <div className="flex items-center gap-2 pl-3 border-l border-zinc-800">
          <button
            onClick={onOpenProject}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            <Folder className="w-3.5 h-3.5 text-zinc-400" />
            <span className="max-w-[140px] truncate font-medium">
              {project ? project.name : 'Select Project'}
            </span>
          </button>

          {project && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              {project.gitBranch && (
                <span className="flex items-center gap-1 font-mono text-[11px] bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800/80">
                  <GitBranch className="w-3 h-3 text-zinc-500" />
                  {project.gitBranch}
                  {project.hasUncommitted && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Uncommitted changes" />
                  )}
                </span>
              )}
              <span className="text-[11px] font-mono px-1.5 py-0.5 bg-zinc-900 rounded text-zinc-400 border border-zinc-800/60">
                {project.language}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-zinc-900/70 p-0.5 rounded-lg border border-zinc-800">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            currentTab === 'dashboard'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </button>

        <button
          onClick={() => onSelectTab('stats')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            currentTab === 'stats'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Statistics
        </button>

        <button
          onClick={() => onSelectTab('settings')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            currentTab === 'settings'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          Settings
        </button>
      </nav>

      {/* Right Provider Statuses */}
      <div className="flex items-center gap-2">
        {providers.map((p) => {
          const isOnline = p.installed;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${
                isOnline
                  ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}
              title={`${p.name}: ${isOnline ? (p.authenticated ? 'Online & Authenticated' : 'Installed (Not Authenticated)') : 'Not Detected in PATH'}`}
            >
              <Cpu className="w-3 h-3" />
              <span>{p.id === 'codex' ? 'Codex' : 'Gemini'}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? (p.authenticated ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-zinc-600'
                }`}
              />
            </div>
          );
        })}

        <button
          onClick={onRefreshProviders}
          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border border-zinc-800"
          title="Refresh CLI discovery"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    </header>
  );
};
