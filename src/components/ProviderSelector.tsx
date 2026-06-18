import { Cpu } from 'lucide-react';
import { useCircuitStore } from '../store';
import type { AIProvider } from '../types';

const PROVIDERS: { id: AIProvider; label: string; model: string; color: string }[] = [
  { id: 'gemini',    label: 'Gemini',    model: '2.5 Pro',     color: 'text-[#4ae176]' },
  { id: 'openai',    label: 'OpenAI',    model: 'GPT-4o',      color: 'text-[#74aa9c]' },
  { id: 'anthropic', label: 'Claude',    model: 'Opus 4.5',   color: 'text-[#d4a96a]' },
];

export default function ProviderSelector() {
  const { aiProvider, setAiProvider } = useCircuitStore();
  const active = PROVIDERS.find((p) => p.id === aiProvider) ?? PROVIDERS[0];

  return (
    <div className="flex items-center gap-1 bg-surface-container border border-outline-variant rounded px-1 py-0.5 h-8">
      <Cpu size={12} className={`${active.color} shrink-0`} />
      <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider hidden sm:inline mr-1">
        via API
      </span>
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => setAiProvider(p.id)}
          title={`${p.label} ${p.model}`}
          className={`
            px-2 py-0.5 rounded font-mono text-[10px] font-medium tracking-wide transition-all duration-150
            ${aiProvider === p.id
              ? `bg-surface-container-highest ${p.color} border border-outline-variant shadow-sm`
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }
          `}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
