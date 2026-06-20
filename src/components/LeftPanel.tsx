import { useState, useEffect, useRef } from 'react';
import { Search, Puzzle, Archive, Bot, Send, MoreHorizontal, Wifi, RotateCcw, Shuffle, ArrowRight, GitCompare, AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react';
import type { NavTab } from '../types';
import AssistantContent from './AssistantContent';
import { useCircuitStore } from '../store';
import { validateArchitecture, findSpec, COMPONENTS } from '../data/components';
import localContext from '../data/localContext.json';

interface LeftPanelProps {
  activeNav: NavTab;
}

export default function LeftPanel({ activeNav }: LeftPanelProps) {
  const [inputText, setInputText] = useState('');
  const [bomOpen, setBomOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    addMessage,
    setIntent,
    setOptions,
    setValidation,
    setPlan,
    setCurrentMilestoneId,
    transitionTo,
    isLoading,
    aiProvider,
    clarifyStage,
    pipelineState,
    clarifyContext,
    appendClarifyContext,
    resetClarifyContext,
    intent,
    reset,
    approved,
    swapSimulation,
    startSwapSimulation,
    applySwapSimulation,
    clearSwapSimulation,
  } = useCircuitStore();

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [useCircuitStore.getState().messages.length]);

  // ── Event handlers for option selection and plan approval ─────────────────
  useEffect(() => {
    const handleSelectOption = async (e: Event) => {
      const { detail: option } = e as CustomEvent;
      // Validation is deterministic — zero LLM calls. See src/data/components.ts.
      transitionTo('VALIDATING');
      const valResult = validateArchitecture(option);
      // setValidation automatically transitions pipelineState to VALIDATED or VALIDATION_BLOCKED
      setValidation(valResult);

      const conflicts = valResult.violations.filter(v => v.severity === 'conflict');
      const warnings  = valResult.violations.filter(v => v.severity === 'warning');

      const issueLines = valResult.violations.length > 0
        ? `\n\n${valResult.violations.map(v => `**[${v.ruleId}]** ${v.message}`).join('\n\n')}`
        : '';

      addMessage({
        role: 'assistant',
        content: conflicts.length === 0
          ? `**DRC validation passed** ✓ — ${warnings.length > 0 ? `${warnings.length} warning(s) to review before approving.` : 'No issues found.'} ${issueLines}\n\nClick **Approve & Generate Plan** below to generate your build roadmap.`
          : `**DRC found ${conflicts.length} conflict(s)** — resolve these before approving:${issueLines}`,
        type: 'validation',
      });
    };

    const handleApprovePlan = async () => {
      const { selectedOptionId, options, aiProvider: provider } = useCircuitStore.getState();
      const option = options.find((o) => o.id === selectedOptionId);
      if (!option) return;

      transitionTo('PLAN_GENERATING');
      try {
        const resPlan = await fetch('/api/plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AI-Provider': provider,
          },
          body: JSON.stringify({ option }),
        });

        // Handle schema validation errors (HTTP 422) from server
        if (resPlan.status === 422) {
          const errBody = await resPlan.json();
          transitionTo('ERROR', {
            stage: 'plan',
            message: errBody.message ?? 'The plan AI response failed schema validation twice.',
            retryable: true,
          });
          addMessage({
            role: 'assistant',
            content: errBody.message ?? 'The AI returned a malformed plan response. Please try again.',
            type: 'error',
          });
          return;
        }

        if (!resPlan.ok) throw new Error(`Plan API error: ${resPlan.status}`);
        const milestones = await resPlan.json();
        const plan = { milestones };
        setPlan(plan);
        if (milestones.length > 0) {
          setCurrentMilestoneId(milestones[0].id);
        }
        transitionTo('AWAITING_APPROVAL');
        addMessage({
          role: 'assistant',
          content: `Your milestone plan is ready — **${milestones.length} steps** are visible in the **Plan** view.\n\n→ Switch to the **Plan** tab, review all milestones, then click **Mark as Reviewed** to unlock the diagram and code panels.`,
          type: 'plan',
        });
      } catch (e: any) {
        console.error('[plan] error:', e);
        transitionTo('ERROR', { stage: 'plan', message: e.message, retryable: true });
        addMessage({ 
          role: 'assistant', 
          content: 'I ran into an issue generating your plan. Please double-check your API key and try again.', 
          type: 'error' 
        });
      }
    };

    window.addEventListener('SELECT_OPTION', handleSelectOption);
    window.addEventListener('APPROVE_PLAN', handleApprovePlan);
    return () => {
      window.removeEventListener('SELECT_OPTION', handleSelectOption);
      window.removeEventListener('APPROVE_PLAN', handleApprovePlan);
    };
  }, []);

  // ── Core submit handler — named pipeline state machine ────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText('');
    addMessage({ role: 'user', content: text });

    const currentStage = clarifyStage;

    try {
      // ── STEP 1: Clarify call ───────────────────────────────────────────────
      const context = currentStage === 'waiting_clarification' ? clarifyContext : [];
      transitionTo('CLARIFYING');

      console.log(`[flow] clarify — stage=${currentStage} provider=${aiProvider} context_turns=${context.length}`);

      const resClarify = await fetch('/api/clarify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Provider': aiProvider,
        },
        body: JSON.stringify({ text, context }),
      });

      // Handle schema validation error (HTTP 422) from server
      if (resClarify.status === 422) {
        const errBody = await resClarify.json();
        transitionTo('ERROR', {
          stage: 'clarify',
          message: errBody.message ?? 'The AI returned a malformed clarify response.',
          retryable: true,
        });
        addMessage({
          role: 'assistant',
          content: errBody.message ?? 'The AI returned a malformed response. Please try again.',
          type: 'error',
        });
        return;
      }

      if (!resClarify.ok) throw new Error(`Clarify API error: ${resClarify.status}`);
      const newIntent = await resClarify.json();
      setIntent(newIntent);

      appendClarifyContext({ role: 'user', content: text });
      appendClarifyContext({
        role: 'assistant',
        content: `Goal identified: ${newIntent.goal}. Missing: ${newIntent.missing_info.join('; ')}`,
      });

      console.log(`[flow] intent — missing_info=${newIntent.missing_info.length} assumptions=${newIntent.assumptions.length}`);

      // ── STEP 2: Decision point ─────────────────────────────────────────────
      if (newIntent.missing_info && newIntent.missing_info.length > 0) {
        addMessage({
          role: 'assistant',
          content: `I understand your goal: **${newIntent.goal}**\n\nBefore I propose options, I need a bit more detail:`,
          type: 'clarify',
        });
        transitionTo('AWAITING_CLARIFY');
        return; // ← HARD STOP — do NOT call /api/compare yet
      }

      const assumptionNote =
        newIntent.assumptions.length > 0
          ? `\n\nAssumptions I'm carrying forward: ${newIntent.assumptions.join('; ')}.`
          : '';

      addMessage({
        role: 'assistant',
        content: `Got it — **${newIntent.goal}**.${assumptionNote}\n\nGenerating two distinct architecture options…`,
        type: 'text',
      });

      // ── STEP 3: Compare call ───────────────────────────────────────────────
      transitionTo('OPTIONS_GENERATING');
      console.log(`[flow] compare — provider=${aiProvider}`);

      const resCompare = await fetch('/api/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Provider': aiProvider,
        },
        body: JSON.stringify({ intent: newIntent }),
      });

      // Handle schema validation error (HTTP 422)
      if (resCompare.status === 422) {
        const errBody = await resCompare.json();
        transitionTo('ERROR', {
          stage: 'compare',
          message: errBody.message ?? 'The AI returned malformed architecture options.',
          retryable: true,
        });
        addMessage({
          role: 'assistant',
          content: errBody.message ?? 'The AI returned a malformed response. Please try again.',
          type: 'error',
        });
        return;
      }

      if (!resCompare.ok) throw new Error(`Compare API error: ${resCompare.status}`);
      const options = await resCompare.json();

      if (!Array.isArray(options) || options.length < 2) {
        throw new Error('Expected exactly 2 architecture options from compare call');
      }

      setOptions(options);
      resetClarifyContext();
      transitionTo('OPTIONS_PRESENTED');

      addMessage({
        role: 'assistant',
        content: 'Here are two architectures with genuine tradeoffs. **Select one to continue** — once you pick, I will run the deterministic DRC validation engine against the component spec table (no AI involved).',
        type: 'options',
      });
    } catch (e: any) {
      console.error('[flow] error:', e);
      transitionTo('ERROR', { stage: 'submit', message: e.message, retryable: true });
      addMessage({
        role: 'assistant',
        content: "I'm having trouble connecting to the AI service right now. Please double-check that your API key is valid and try again.",
        type: 'error',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const placeholder =
    isLoading
      ? 'Thinking…'
      : clarifyStage === 'waiting_clarification'
        ? 'Answer the clarifying question…'
        : approved
          ? 'Ask about milestone 1 or request changes…'
          : 'Describe your idea…';

  // Input is disabled while loading, while waiting for option selection, or while pending approval
  // Once APPROVED the user can ask follow-up questions
  const inputDisabled =
    isLoading ||
    pipelineState === 'OPTIONS_PRESENTED' ||
    pipelineState === 'OPTIONS_GENERATING' ||
    (pipelineState === 'VALIDATING') ||
    (pipelineState === 'VALIDATION_BLOCKED' && !approved) ||
    (pipelineState === 'VALIDATED' && !approved) ||
    pipelineState === 'AWAITING_APPROVAL';  // locked until user clicks Mark as Reviewed

  return (
    <div className="w-full h-full border-r border-outline-variant flex flex-col bg-surface">
      {/* Panel header */}
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
        <div className="flex items-center gap-1">
          {activeNav === 'assistant' && (
            <button
              onClick={() => reset()}
              title="New conversation"
              className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
            >
              <RotateCcw size={15} />
            </button>
          )}
          <button className="text-on-surface-variant hover:text-on-surface p-1">
            {activeNav === 'logic' ? <Search size={18} /> : <MoreHorizontal size={18} />}
          </button>
        </div>
      </div>

      {/* Scrollable chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-panel-padding flex flex-col gap-lg">
        {activeNav === 'logic' ? <LogicContent /> : <AssistantContent />}
      </div>

      {/* Input area (assistant tab only) */}
      {activeNav === 'assistant' && (
        <div className="p-panel-padding border-t border-outline-variant bg-surface shrink-0">
          {/* Stage indicator */}
          {clarifyStage === 'waiting_clarification' && (
            <div className="mb-2 flex items-center gap-1.5 text-tertiary">
              <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-wider">Waiting for your answer</span>
            </div>
          )}
          {clarifyStage === 'options_ready' && (
            <div className="mb-2 flex items-center gap-1.5 text-secondary">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span className="font-mono text-[9px] uppercase tracking-wider">Select an option above to continue</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={inputDisabled}
              rows={1}
              className="w-full bg-surface-container-low border border-outline-variant rounded px-md py-2 text-sm focus:outline-none focus:border-secondary transition-colors pr-xl resize-none leading-normal disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={placeholder}
            />
            <button
              type="submit"
              disabled={inputDisabled || !inputText.trim()}
              className="absolute right-2 text-on-surface-variant hover:text-secondary disabled:opacity-40 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* What-If Simulation Sandbox (Module I Stretch) */}
      {approved && activeNav === 'assistant' && <WhatIfSandbox />}

      {/* Bill of Materials widget (collapsible — keeps the chat roomy) */}
      <div className="border-t border-outline-variant shrink-0 bg-surface-container-low">
        <button
          onClick={() => setBomOpen((o) => !o)}
          className="w-full h-10 px-panel-padding flex items-center justify-between hover:bg-surface-container transition-colors"
        >
          <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant">
            Bill of Materials
          </span>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Archive size={16} />
            <ChevronDown size={14} className={`transition-transform ${bomOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {bomOpen && (
          <div className="border-t border-outline-variant">
            <BOMWidget />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BOM Widget — shows selected option's components with local context ──────
function BOMWidget() {
  const { options, selectedOptionId } = useCircuitStore();
  const selected = options.find((o) => o.id === selectedOptionId);

  if (!selected) {
    return (
      <div className="p-3 flex flex-col items-center justify-center gap-1 text-center">
        <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant opacity-60">
          Select an architecture option to populate the bill of materials
        </span>
      </div>
    );
  }

  return (
    <div className="p-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
      {selected.components.map((comp) => {
        const spec = findSpec(comp);
        const contextData = spec ? (localContext as any)[spec.name] : null;
        const cost = contextData?.cost_range ?? '—';
        const note = contextData?.sourcing_note ?? 'Verify connections manually.';

        return (
          <div key={comp} className="flex flex-col gap-0.5 p-2 hover:bg-surface-container rounded border border-transparent hover:border-outline-variant/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span className="font-bold text-on-surface">{spec?.name || comp}</span>
                {comp.includes('Pin') && (
                  <span className="text-[10px] text-on-surface-variant opacity-75">
                    ({comp.match(/\(([^)]+)\)/)?.[1] || ''})
                  </span>
                )}
              </div>
              <span className="font-mono text-secondary font-bold text-[10px] bg-secondary/10 px-1.5 py-[1px] rounded shrink-0">
                {cost}
              </span>
            </div>
            <span className="text-[9px] text-on-surface-variant leading-snug pl-3">
              {note}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── What-If Sandbox — Module I stretch feature ──────────────────────────────
function WhatIfSandbox() {
  const {
    options,
    selectedOptionId,
    validation,
    plan,
    swapSimulation,
    startSwapSimulation,
    applySwapSimulation,
    clearSwapSimulation,
    isLoading
  } = useCircuitStore();

  const selected = options.find((o) => o.id === selectedOptionId);
  const [origComp, setOrigComp] = useState('');
  const [replComp, setReplComp] = useState('');
  const [open, setOpen] = useState(false);

  // Get only peripherals from the current option (exclude microcontroller)
  const activePeripherals = selected
    ? selected.components.filter((c) => {
        const spec = findSpec(c);
        return spec && !spec.is_microcontroller;
      })
    : [];

  // Get all spec peripherals (excluding microcontrollers)
  const availableReplacements = COMPONENTS.filter((c) => !c.is_microcontroller);

  useEffect(() => {
    if (activePeripherals.length > 0) {
      // If currently selected origComp is no longer in activePeripherals, reset it
      if (!origComp || !activePeripherals.includes(origComp)) {
        setOrigComp(activePeripherals[0]);
      }
    }
  }, [activePeripherals, origComp]);

  useEffect(() => {
    if (availableReplacements.length > 0 && !replComp) {
      setReplComp(availableReplacements[0].name);
    }
  }, [availableReplacements, replComp]);

  if (!selected) return null;

  const handleSimulate = () => {
    if (origComp && replComp) {
      startSwapSimulation(origComp, replComp);
    }
  };

  return (
    <div className="border-t border-outline-variant bg-surface-container-low shrink-0 flex flex-col">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-10 px-panel-padding flex items-center justify-between bg-surface-container hover:bg-surface-container-highest transition-colors"
      >
        <div className="flex items-center gap-1.5 text-secondary">
          <Shuffle size={14} />
          <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase">
            What-If Sandbox
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant opacity-60">
            Try swapping parts
          </span>
          <ChevronDown size={14} className={`text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <div className={`p-panel-padding flex-col gap-sm border-t border-outline-variant ${open ? 'flex' : 'hidden'}`}>
        {!swapSimulation.active ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] uppercase tracking-wide text-on-surface-variant">Replace Component</label>
              <select
                value={origComp}
                onChange={(e) => setOrigComp(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none focus:border-secondary"
              >
                {activePeripherals.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] uppercase tracking-wide text-on-surface-variant">With Alternative</label>
              <select
                value={replComp}
                onChange={(e) => setReplComp(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none focus:border-secondary"
              >
                {availableReplacements.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSimulate}
              disabled={isLoading || !origComp || !replComp}
              className="w-full bg-secondary text-on-secondary py-1.5 rounded text-xs font-bold hover:bg-secondary-fixed transition-colors disabled:opacity-50 mt-1 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <GitCompare size={12} />
              Simulate Swap
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1 p-2 rounded bg-surface border border-outline-variant">
              <span className="font-mono text-[9px] uppercase tracking-wide text-on-surface-variant mb-1">Swap Summary</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-error font-mono font-bold line-through truncate max-w-[100px]">{findSpec(swapSimulation.originalComponent || '')?.name || swapSimulation.originalComponent}</span>
                <ArrowRight size={12} className="text-on-surface-variant shrink-0" />
                <span className="text-secondary font-mono font-bold truncate max-w-[100px]">{swapSimulation.replacementComponent}</span>
              </div>
            </div>

            {/* Validation Comparison */}
            <div className="flex flex-col gap-1.5 p-2 rounded bg-surface border border-outline-variant">
              <span className="font-mono text-[9px] uppercase tracking-wide text-on-surface-variant">Validation Impact</span>
              
              {/* Before Validation */}
              <div className="flex flex-col gap-1 text-[11px] border-b border-outline-variant/30 pb-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-on-surface-variant">BEFORE:</span>
                  <span className={`font-mono text-[9px] font-bold uppercase ${validation?.valid ? 'text-secondary' : 'text-error'}`}>
                    {validation?.valid ? 'Validated' : 'Requires Review'}
                  </span>
                </div>
                {validation?.violations.filter(v => v.severity === 'warning').map((v, i) => (
                  <div key={i} className="text-tertiary bg-tertiary/10 p-1.5 rounded flex gap-1 items-start text-[10px]">
                    <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                    <span className="font-mono text-[9px] font-bold mr-0.5">[{v.ruleId}]</span>
                    <span>{v.message}</span>
                  </div>
                ))}
                {validation?.violations.filter(v => v.severity === 'conflict').map((v, i) => (
                  <div key={i} className="text-error bg-error/10 p-1.5 rounded flex gap-1 items-start text-[10px]">
                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                    <span className="font-mono text-[9px] font-bold mr-0.5">[{v.ruleId}]</span>
                    <span>{v.message}</span>
                  </div>
                ))}
                {validation?.violations.length === 0 && (
                  <span className="text-on-surface-variant pl-1 italic">No issues.</span>
                )}
              </div>

              {/* After Validation */}
              <div className="flex flex-col gap-1 text-[11px] pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-on-surface-variant">AFTER SIMULATION:</span>
                  <span className={`font-mono text-[9px] font-bold uppercase ${swapSimulation.simulatedValidation?.valid ? 'text-secondary' : 'text-error'}`}>
                    {swapSimulation.simulatedValidation?.valid ? 'Validated' : 'Requires Review'}
                  </span>
                </div>
                {swapSimulation.simulatedValidation?.violations.filter(v => v.severity === 'warning').map((v, i) => (
                  <div key={i} className="text-tertiary bg-tertiary/10 p-1.5 rounded flex gap-1 items-start text-[10px] animate-pulse">
                    <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                    <span className="font-mono text-[9px] font-bold mr-0.5">[{v.ruleId}]</span>
                    <span>{v.message}</span>
                  </div>
                ))}
                {swapSimulation.simulatedValidation?.violations.filter(v => v.severity === 'conflict').map((v, i) => (
                  <div key={i} className="text-error bg-error/10 p-1.5 rounded flex gap-1 items-start text-[10px] animate-pulse">
                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                    <span className="font-mono text-[9px] font-bold mr-0.5">[{v.ruleId}]</span>
                    <span>{v.message}</span>
                  </div>
                ))}
                {swapSimulation.simulatedValidation?.violations.length === 0 && (
                  <span className="text-secondary pl-1 font-mono text-[10px] font-bold">✓ All DRC rules passed</span>
                )}
              </div>
            </div>

            {/* Plan Comparison */}
            {swapSimulation.simulatedPlan && (
              <div className="flex flex-col gap-1 p-2 rounded bg-surface border border-outline-variant text-[11px]">
                <span className="font-mono text-[9px] uppercase tracking-wide text-on-surface-variant mb-1">Plan Impact</span>
                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                  {swapSimulation.simulatedPlan.milestones.map((m, idx) => {
                    const originalM = plan?.milestones[idx];
                    const isChanged = originalM?.title !== m.title || originalM?.description !== m.description;
                    return (
                      <div key={m.id} className={`p-1 rounded ${isChanged ? 'bg-secondary/15 border-l-2 border-secondary pl-1.5' : 'bg-surface-container'}`}>
                        <div className="font-bold flex items-center justify-between text-[10px]">
                          <span>M{idx + 1}: {m.title}</span>
                          {isChanged && <span className="font-mono text-[8px] uppercase text-secondary font-bold shrink-0">Updated</span>}
                        </div>
                        <p className="text-[9px] text-on-surface-variant leading-snug">{m.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => applySwapSimulation()}
                className="flex-1 bg-secondary text-on-secondary py-1.5 rounded text-xs font-bold hover:bg-secondary-fixed transition-colors cursor-pointer text-center"
              >
                Apply Swap
              </button>
              <button
                onClick={() => clearSwapSimulation()}
                className="flex-1 bg-surface-container border border-outline-variant py-1.5 rounded text-xs font-bold hover:bg-surface-container-highest transition-colors cursor-pointer text-center text-on-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Logic panel content ──────────────────────────────────────────────────────
function LogicContent() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 pb-4 border-b border-outline-variant">
        {[
          { label: 'Output', color: 'bg-secondary' },
          { label: 'Input', color: 'bg-tertiary' },
          { label: 'Control', color: 'bg-error' },
          { label: 'Math', color: 'bg-[#4ae176]' },
          { label: 'Variables', color: 'bg-[#c678dd]' },
        ].map((cat) => (
          <div key={cat.label} className="flex items-center gap-2 p-1 hover:bg-surface-container rounded cursor-pointer">
            <div className={`w-3 h-3 rounded-full ${cat.color}`} />
            <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-on-surface">{cat.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Hardware Blocks</div>

        <div className="bg-secondary/20 border border-secondary/30 p-2 rounded flex flex-col gap-1 cursor-grab active:cursor-grabbing">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[13px] text-secondary">set built-in LED to</span>
            <div className="bg-surface px-1 py-[2px] rounded border border-outline-variant text-[10px] text-on-surface">HIGH</div>
          </div>
        </div>

        <div className="bg-tertiary/20 border border-tertiary/30 p-2 rounded flex flex-col gap-1 cursor-grab active:cursor-grabbing">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[13px] text-tertiary">read distance (cm)</span>
            <Wifi size={14} className="text-tertiary" />
          </div>
        </div>

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
