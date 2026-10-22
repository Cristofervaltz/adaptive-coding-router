import React, { useState } from 'react';
import { GitDiffSummary } from '../types';
import { FileCode, Plus, Minus, FileText } from 'lucide-react';

interface DiffViewerProps {
  diff: GitDiffSummary | null;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (!diff || diff.files.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 border border-zinc-800 rounded-lg bg-zinc-950/50">
        <FileCode className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No Git changes detected in the isolated worktree.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-zinc-800 rounded-lg bg-zinc-950 overflow-hidden">
      {/* Header Summary */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-medium text-zinc-200">Changed Files ({diff.files.length})</span>
          <span className="flex items-center text-emerald-400 font-mono">
            <Plus className="w-3 h-3 mr-0.5" />
            {diff.totalAdditions}
          </span>
          <span className="flex items-center text-rose-400 font-mono">
            <Minus className="w-3 h-3 mr-0.5" />
            {diff.totalDeletions}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-800">
        {/* File List */}
        <div className="w-full md:w-64 max-h-64 overflow-y-auto divide-y divide-zinc-900 bg-zinc-950/80">
          {diff.files.map((file) => (
            <button
              key={file.path}
              onClick={() => setSelectedFile(file.path)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                selectedFile === file.path ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                <span className="truncate font-mono">{file.path}</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] shrink-0 ml-2">
                <span className="text-emerald-400">+{file.additions}</span>
                <span className="text-rose-400">-{file.deletions}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Diff Text View */}
        <div className="flex-1 p-3 overflow-x-auto font-mono text-[11px] leading-relaxed max-h-96 overflow-y-auto bg-zinc-950">
          {diff.rawDiff ? (
            <pre className="text-zinc-300 whitespace-pre">
              {diff.rawDiff.split('\n').map((line, idx) => {
                let lineClass = 'text-zinc-400';
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  lineClass = 'bg-emerald-950/40 text-emerald-300';
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  lineClass = 'bg-rose-950/40 text-rose-300';
                } else if (line.startsWith('@@')) {
                  lineClass = 'text-cyan-400 font-semibold';
                }

                return (
                  <div key={idx} className={`px-1 rounded-sm ${lineClass}`}>
                    {line}
                  </div>
                );
              })}
            </pre>
          ) : (
            <div className="text-zinc-500 italic py-6 text-center">
              Files were created or updated without standard diff lines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
