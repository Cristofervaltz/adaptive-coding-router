import React, { useState, useEffect } from 'react';
import { SubscriptionSettings, ProviderStatus } from '../types';
import {
  Settings as SettingsIcon,
  Shield,
  Sliders,
  Terminal,
  Save,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface SettingsProps {
  onSettingsSaved?: () => void;
  providers?: ProviderStatus[];
}

export const Settings: React.FC<SettingsProps> = ({ onSettingsSaved, providers = [] }) => {
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const activeProviders = providers.filter(
    (p) => p.installed && p.availableModels && p.availableModels.length > 0
  );

  useEffect(() => {
    const fetchSettings = async () => {
      if (!window.acrApi) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await window.acrApi.getSettings();
        setSettings(data);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || isSaving) return;

    try {
      setIsSaving(true);
      const updated = await window.acrApi.saveSettings(settings);
      setSettings(updated);
      setSavedSuccess(true);
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-xs">Loading configuration...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-zinc-400">
        <span className="text-xs">Unable to load settings</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto p-6">
      <form onSubmit={handleSave} className="max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-blue-500" />
              Settings & Policy Configuration
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tune subscription quotas, CLI paths, execution limits, and model escalation rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Settings saved
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white text-xs font-medium transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        {/* Section 1: Subscription Quota & Reserve Mode */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-zinc-200">
              Subscription Quota & Reservation
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Reserve OpenAI Toggle */}
            <label className="flex items-start justify-between cursor-pointer gap-4">
              <div>
                <span className="font-medium text-zinc-200 block">Reserve OpenAI Mode</span>
                <span className="text-zinc-500 text-[11px] block mt-0.5">
                  When enabled, tasks default to Google Gemini 3.8 and Astra High where possible to
                  preserve shared ChatGPT Plus or Pro subscription limits.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.reserveOpenAI}
                onChange={(e) => setSettings({ ...settings, reserveOpenAI: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
            </label>

            {/* Allow Ultra Escalation Toggle */}
            <label className="flex items-start justify-between cursor-pointer gap-4 pt-2 border-t border-zinc-800/60">
              <div>
                <span className="font-medium text-zinc-200 block">
                  Permit GPT-6.1 Sol Ultra Escalations
                </span>
                <span className="text-zinc-500 text-[11px] block mt-0.5">
                  Allows the router to step up to Sol Ultra for high complexity or failed code runs.
                  Sol Ultra consumes heavy quota allocations.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.allowUltra}
                onChange={(e) => setSettings({ ...settings, allowUltra: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
            </label>

            {/* Native Subscription & Quota Pool Detection Display */}
            <div className="pt-2 border-t border-zinc-800/60 space-y-3">
              <span className="block font-medium text-zinc-300 text-xs">
                Natively Detected Subscriptions & Quota Allocations
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Codex */}
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-zinc-200">OpenAI Codex</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-400 border border-blue-800/50">
                      {settings.detectedCodexPlan || 'Plus Tier'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 space-y-0.5">
                    {settings.detectedCodexEmail && (
                      <p className="text-zinc-500 font-mono text-[10px]">Account: {settings.detectedCodexEmail}</p>
                    )}
                    <p className="text-zinc-400">
                      {settings.detectedCodexPlan?.includes('Unlimited')
                        ? 'Continuous execution without 5-hour rolling limits ($500 Plan)'
                        : 'Enforces standard 5-hour rolling window (40 reqs)'}
                    </p>
                  </div>
                </div>

                {/* Antigravity Dual-Pool */}
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-zinc-200">Google Antigravity</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                      Dual-Pool Quota Mode
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 space-y-0.5">
                    <p className="text-zinc-400">
                      Separate quotas: native Gemini models (1000 RPM) and shared partner quota for Claude + GPT.
                    </p>
                  </div>
                </div>

                {/* Claude Code */}
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-zinc-200">Anthropic Claude Code</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 text-purple-400 border border-purple-800/50">
                      {settings.detectedClaudeTier || '5.5 Multi-Pool'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 space-y-0.5">
                    <p className="text-zinc-400">
                      Separate dedicated quota pool for Fable 5.5 distinct from Core 5.5 and Haiku
                    </p>
                  </div>
                </div>

                {/* OpenCode */}
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-zinc-200">OpenCode CLI</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-400 border border-amber-800/50">
                      {settings.detectedOpenCodeTier || 'Local + Cloud'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 space-y-0.5">
                    <p className="text-zinc-400">
                      Local Ollama / vLLM execution (zero quota cost) + Free Cloud API tier
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quota limit and counters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/60">
              <div>
                <span className="block font-medium text-zinc-300 mb-1">
                  OpenAI Compute Budget
                </span>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={settings.openAIBudget}
                  onChange={(e) =>
                    setSettings({ ...settings, openAIBudget: Number(e.target.value) || 0 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-zinc-300">OpenAI Budget Used</span>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, openAIUsed: 0, codex5hUsed: 0 })}
                    className="text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={settings.openAIUsed}
                  onChange={(e) =>
                    setSettings({ ...settings, openAIUsed: Number(e.target.value) || 0 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-zinc-300">Fable 5.5 Pool Used</span>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, claudeFableUsed: 0 })}
                    className="text-[10px] text-amber-400 hover:text-amber-300"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={settings.claudeFableUsed || 0}
                  onChange={(e) =>
                    setSettings({ ...settings, claudeFableUsed: Number(e.target.value) || 0 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: CLI Binary Paths */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-200">Local CLI Executable Paths</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                OpenAI Codex CLI Binary or Command
              </label>
              <input
                type="text"
                value={settings.codexPath}
                onChange={(e) => setSettings({ ...settings, codexPath: e.target.value })}
                placeholder="codex or C:\path\to\codex.exe"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Standard binary name in PATH or full absolute path to the executable.
              </span>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Google Antigravity CLI Binary or Command
              </label>
              <input
                type="text"
                value={settings.antigravityPath || ''}
                onChange={(e) => setSettings({ ...settings, antigravityPath: e.target.value })}
                placeholder="agy or C:\Users\...\AppData\Local\agy\bin\agy.exe"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Auto-resolved from AppData\Local\agy\bin\agy.exe, Antigravity IDE, or PATH.
              </span>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Anthropic Claude CLI Binary or Command
              </label>
              <input
                type="text"
                value={settings.claudePath}
                onChange={(e) => setSettings({ ...settings, claudePath: e.target.value })}
                placeholder="claude or C:\path\to\claude.cmd"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Standard binary name in PATH or full absolute path to the executable.
              </span>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                OpenCode CLI Binary or Command
              </label>
              <input
                type="text"
                value={settings.opencodePath}
                onChange={(e) => setSettings({ ...settings, opencodePath: e.target.value })}
                placeholder="opencode or C:\path\to\opencode.exe"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Standard binary name in PATH or full absolute path to the executable.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Execution Controls & Defaults */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-zinc-200">
              Execution Limits & Routing Preferences
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Max Escalation Attempts per Task
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={settings.maxAttempts}
                onChange={(e) =>
                  setSettings({ ...settings, maxAttempts: Number(e.target.value) || 1 })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Allowed automated retries with stronger models (1 to 5).
              </span>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Process Timeout (Seconds)
              </label>
              <input
                type="number"
                min="30"
                max="3600"
                value={settings.timeoutSeconds}
                onChange={(e) =>
                  setSettings({ ...settings, timeoutSeconds: Number(e.target.value) || 300 })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Force terminate CLI process trees after this duration.
              </span>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Default Routing Mode</label>
              <select
                value={settings.routingMode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    routingMode: e.target.value as 'auto' | 'manual',
                  })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-sans"
              >
                <option value="auto">Automatic (Router selects model)</option>
                <option value="manual">Manual (Pinned model)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Manual Fallback Model
              </label>
              <select
                value={settings.manualModel}
                onChange={(e) => setSettings({ ...settings, manualModel: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono"
              >
                {activeProviders.length === 0 ? (
                  <option value="gpt-6.1-sol">gpt-6.1-sol</option>
                ) : (
                  activeProviders.map((prov) => (
                    <optgroup
                      key={prov.id}
                      label={prov.name}
                      className="bg-zinc-900 text-zinc-400 font-sans"
                    >
                      {prov.availableModels.map((modelId) => (
                        <option
                          key={modelId}
                          value={modelId}
                          className="bg-zinc-900 text-zinc-200 font-mono"
                        >
                          {modelId}
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
