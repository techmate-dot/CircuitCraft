import { useState, useEffect } from 'react';
import { Search, Puzzle, Archive, Bot, Send, MoreHorizontal, Wifi } from 'lucide-react';
import type { NavTab } from '../types';
import AssistantContent from './AssistantContent';
import { useCircuitStore } from '../store';
import { validateArchitecture } from '../data/components';

interface LeftPanelProps {
  activeNav: NavTab;
}

export default function LeftPanel({ activeNav }: LeftPanelProps) {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addMessage, setIntent, setOptions, selectedOptionId, setValidation, setPlan } = useCircuitStore();

  useEffect(() => {
    const handleSelectOption = async (e: Event) => {
      const { detail: option } = e as CustomEvent;
      // 1. Run validation
      const valResult = validateArchitecture(option);
      setValidation(valResult);
      addMessage({ role: 'assistant', content: 'Validation complete. Please review the results.', type: 'validation' });
    };

    const handleApprovePlan = async () => {
      const optionId = useCircuitStore.getState().selectedOptionId;
      const options = useCircuitStore.getState().options;
      const option = options.find(o => o.id === optionId);
      if (!option) return;

      setIsLoading(true);
      try {
        const resPlan = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ option })
        });
        const milestones = await resPlan.json();
        setPlan({ milestones });
        addMessage({ role: 'assistant', content: 'Here is your generated milestone plan. Check the Assembly Guide!', type: 'plan' });
      } catch (e: any) {
        addMessage({ role: 'assistant', content: `Error: ${e.message}` });
      }
      setIsLoading(false);
    };

    window.addEventListener('SELECT_OPTION', handleSelectOption);
    window.addEventListener('APPROVE_PLAN', handleApprovePlan);
    return () => {
      window.removeEventListener('SELECT_OPTION', handleSelectOption);
      window.removeEventListener('APPROVE_PLAN', handleApprovePlan);
    };
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const text = inputText;
    setInputText('');
    addMessage({ role: 'user', content: text });
    setIsLoading(true);

    try {
      // 1. Clarify
      const resClarify = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const intent = await resClarify.json();
      setIntent(intent);

      if (intent.missing_info && intent.missing_info.length > 0) {
        addMessage({ role: 'assistant', content: `I can help with that! However, some details are missing:\n\n- ${intent.missing_info.join('\n- ')}\n\nI am assuming: ${intent.assumptions.join(', ')}. Is that okay? Or tell me more.`, type: 'text' });
      } else {
        addMessage({ role: 'assistant', content: `Great! I understand you want to build: ${intent.goal}. Let me prepare some options...`, type: 'text' });
      }

      // 2. Compare options
      const resCompare = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent })
      });
      const options = await resCompare.json();
      setOptions(options);
      
      addMessage({ role: 'assistant', content: 'Here are two architecture options with different tradeoffs. Which one do you prefer?', type: 'options' });

    } catch (e: any) {
      addMessage({ role: 'assistant', content: `Error: ${e.message}` });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="w-[24%] border-r border-outline-variant flex flex-col bg-surface min-w-[280px]">
      {/* Header */}
      <div className="h-12 border-b border-outline-variant flex items-center px-panel-padding justify-between shrink-0">
        <div className="flex items-center gap-sm text-secondary">
          {activeNav === 'logic' ? (
            <>
              <Puzzle size={18} />
              <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase">Logic Blocks</span>
            </>
          ) : (
            <>
              <Bot size={18} />
              <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase">Copilot</span>
            </>
          )}
        </div>
        <button className="text-on-surface-variant hover:text-on-surface">
          {activeNav === 'logic' ? <Search size={18} /> : <MoreHorizontal size={18} />}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-panel-padding flex flex-col gap-lg">
        {activeNav === 'logic' ? <LogicContent /> : <AssistantContent />}
      </div>

      {/* Input area for Assistant */}
      {activeNav === 'assistant' && (
        <div className="p-panel-padding border-t border-outline-variant bg-surface">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              className="w-full bg-surface-container-low border border-outline-variant rounded px-md py-2 text-sm focus:outline-none focus:border-secondary transition-colors pr-xl" 
              placeholder={isLoading ? "Thinking..." : "Ask Copilot..."} 
              type="text" 
            />
            <button type="submit" disabled={isLoading} className="absolute right-2 text-on-surface-variant hover:text-secondary disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* BOM Widget */}
      <div className="border-t border-outline-variant shrink-0 bg-surface-container-low">
        <div className="h-10 px-panel-padding flex items-center justify-between border-b border-outline-variant">
          <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant">Bill of Materials</span>
          <Archive size={16} className="text-on-surface-variant" />
        </div>
        <div className="p-2 flex flex-col gap-1">
          <div className="flex items-center justify-between p-2 hover:bg-surface-container rounded cursor-pointer group">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-secondary"></div>
              <span className="font-mono text-[13px] text-on-surface">ESP32 DevKit v1</span>
            </div>
            <span className="font-mono text-[10px] text-on-surface-variant border border-outline-variant px-1 rounded bg-surface">MCU</span>
          </div>
          <div className="flex items-center justify-between p-2 hover:bg-surface-container rounded cursor-pointer group">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-tertiary"></div>
              <span className="font-mono text-[13px] text-on-surface">HC-SR04P</span>
            </div>
            <span className="font-mono text-[10px] text-on-surface-variant border border-outline-variant px-1 rounded bg-surface">SENSOR</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogicContent() {
  return (
    <div className="flex flex-col gap-4">
      {/* Block Categories */}
      <div className="grid grid-cols-2 gap-2 pb-4 border-b border-outline-variant">
        {[
          { label: 'Output', color: 'bg-secondary' },
          { label: 'Input', color: 'bg-tertiary' },
          { label: 'Control', color: 'bg-error' },
          { label: 'Math', color: 'bg-[#4ae176]' },
          { label: 'Variables', color: 'bg-[#c678dd]' },
        ].map(cat => (
          <div key={cat.label} className="flex items-center gap-2 p-1 hover:bg-surface-container rounded cursor-pointer">
            <div className={`w-3 h-3 rounded-full ${cat.color}`}></div>
            <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-on-surface">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Hardware Specific Blocks */}
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Hardware Blocks</div>
        
        {/* Block: Set LED */}
        <div className="bg-secondary/20 border border-secondary/30 p-2 rounded flex flex-col gap-1 cursor-grab active:cursor-grabbing">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[13px] text-secondary">set built-in LED to</span>
            <div className="bg-surface px-1 py-[2px] rounded border border-outline-variant text-[10px] text-on-surface">HIGH</div>
          </div>
        </div>

        {/* Block: Read Distance */}
        <div className="bg-tertiary/20 border border-tertiary/30 p-2 rounded flex flex-col gap-1 cursor-grab active:cursor-grabbing">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[13px] text-tertiary">read distance (cm)</span>
            <Wifi size={14} className="text-tertiary" />
          </div>
        </div>

        {/* Block: Set Pin */}
        <div className="bg-secondary/20 border border-secondary/30 p-2 rounded flex flex-col gap-1 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] text-secondary">set pin</span>
            <div className="bg-surface px-1 py-[2px] rounded border border-outline-variant text-[10px] text-on-surface">5</div>
            <span className="font-mono text-[13px] text-secondary">to</span>
            <div className="bg-surface px-1 py-[2px] rounded border border-outline-variant text-[10px] text-on-surface">HIGH</div>
          </div>
        </div>
      </div>
    </div>
  );
}
