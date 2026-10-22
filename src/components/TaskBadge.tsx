import React from 'react';
import { TaskStatus, TaskCategory } from '../types';

export const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const configs: Record<TaskStatus, { label: string; bg: string; text: string; border: string }> = {
    queued: { label: 'Queued', bg: 'bg-zinc-800/60', text: 'text-zinc-300', border: 'border-zinc-700' },
    analyzing: { label: 'Analyzing', bg: 'bg-cyan-950/40', text: 'text-cyan-400', border: 'border-cyan-800/50' },
    running: { label: 'Running', bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-800/50' },
    validating: { label: 'Validating', bg: 'bg-indigo-950/40', text: 'text-indigo-400', border: 'border-indigo-800/50' },
    retrying: { label: 'Retrying', bg: 'bg-yellow-950/40', text: 'text-yellow-400', border: 'border-yellow-800/50' },
    escalating: { label: 'Escalating', bg: 'bg-purple-950/40', text: 'text-purple-400', border: 'border-purple-800/50' },
    awaiting_approval: { label: 'Awaiting Approval', bg: 'bg-amber-950/50', text: 'text-amber-400', border: 'border-amber-700/60' },
    completed: { label: 'Completed', bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800/50' },
    failed: { label: 'Failed', bg: 'bg-rose-950/40', text: 'text-rose-400', border: 'border-rose-800/50' },
    cancelled: { label: 'Cancelled', bg: 'bg-zinc-900', text: 'text-zinc-500', border: 'border-zinc-800' },
  };

  const cfg = configs[status] || configs.queued;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {cfg.label}
    </span>
  );
};

export const CategoryBadge: React.FC<{ category: TaskCategory }> = ({ category }) => {
  const labels: Record<TaskCategory, string> = {
    simple_code: 'Simple Code',
    complex_code: 'Complex Code',
    architecture: 'Architecture',
    debugging: 'Debugging',
    asset_generation: '3D Asset',
    animation: 'Animation',
    visual_design: 'UI / UX',
    refactoring: 'Refactor',
    documentation: 'Docs',
  };

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
      {labels[category] || category}
    </span>
  );
};
