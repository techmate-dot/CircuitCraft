import { create } from 'zustand';
import type {
  IntentObject,
  ArchitectureOption,
  MilestonePlan,
  ClarifyStage,
  PipelineState,
  PipelineError,
  AIProvider,
} from './types';
import type { ValidationResult, ComponentSpec } from './data/components';
import { validateArchitecture } from './data/components';

// ─── Chat message shape ───────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /**
   * type drives which interactive widget renders inside the bubble:
   *   text         → plain markdown (default)
   *   clarify      → ClarifyCard — shows missing_info + assumptions
   *   options      → OptionCards — shows 2 architecture options with tradeoffs
   *   validation   → ValidationCard — violations + approval gate
   *   plan         → plain text pointing to Plan canvas
   *   error        → ErrorCard — schema/API failure with optional retry
   */
  type?: 'text' | 'clarify' | 'options' | 'validation' | 'plan' | 'error';
}

export interface SwapSimulation {
  active: boolean;
  originalComponent: string | null;
  replacementComponent: string | null;
  simulatedOption: ArchitectureOption | null;
  simulatedValidation: ValidationResult | null;
  simulatedPlan: MilestonePlan | null;
}

// ─── Store interface ──────────────────────────────────────────────────────────
interface CircuitStore {
  // ── AI Provider selection ────────────────────────────────────────────────
  aiProvider: AIProvider;
  setAiProvider: (p: AIProvider) => void;

  // ── Pipeline State Machine ────────────────────────────────────────────────
  // Single field — replaces all ad-hoc isLoading / approved / clarifyStage booleans.
  // Transitions only via the named action methods below.
  pipelineState: PipelineState;
  pipelineError: PipelineError | null;

  // Named transition actions (the only way to move between pipeline states)
  transitionTo: (state: PipelineState, error?: PipelineError) => void;

  // ── Derived compat accessors (read-only; drive existing UI components) ────
  // These are computed from pipelineState so UI components don't need rewriting.
  readonly isLoading: boolean;
  readonly approved: boolean;
  readonly clarifyStage: ClarifyStage;

  // Keep setIsLoading as a no-op alias — real state is pipelineState
  setIsLoading: (v: boolean) => void;
  setApproved: (approved: boolean) => void;
  setClarifyStage: (s: ClarifyStage) => void;

  // ── Chat history ──────────────────────────────────────────────────────────
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;

  // ── Clarify conversation context ──────────────────────────────────────────
  clarifyContext: { role: 'user' | 'assistant'; content: string }[];
  appendClarifyContext: (entry: { role: 'user' | 'assistant'; content: string }) => void;
  resetClarifyContext: () => void;

  // ── Module B: Intent ──────────────────────────────────────────────────────
  intent: IntentObject | null;
  setIntent: (intent: IntentObject | null) => void;

  // ── Module C: Architecture options ───────────────────────────────────────
  options: ArchitectureOption[];
  setOptions: (options: ArchitectureOption[]) => void;

  selectedOptionId: string | null;
  setSelectedOptionId: (id: string | null) => void;

  // ── Module E: Validation (deterministic — no LLM) ────────────────────────
  validation: ValidationResult | null;
  setValidation: (result: ValidationResult | null) => void;

  // ── Module F: Milestone plan ──────────────────────────────────────────────
  plan: MilestonePlan | null;
  setPlan: (plan: MilestonePlan | null) => void;

  currentMilestoneId: string | null;
  setCurrentMilestoneId: (id: string | null) => void;

  // ── Module G: Generated code ──────────────────────────────────────────────
  generatedCode: string | null;
  setGeneratedCode: (code: string | null) => void;

  // ── Runtime block registry ────────────────────────────────────────────────
  // Components added on-demand (via the Generate Block panel) at runtime.
  // These extend the static COMPONENTS table without requiring a code change.
  customComponents: ComponentSpec[];
  addCustomComponent: (spec: ComponentSpec) => void;

  // ── Workspace snapshot ─────────────────────────────────────────────────────
  // Serialised Blockly workspace state captured once per debounced change.
  // The simulator (Section 5) restores this in a sandboxed iframe so it never
  // needs to re-traverse the live workspace — single traversal, two consumers.
  workspaceState: object | null;
  setWorkspaceState: (state: object | null) => void;

  // ── Module I: What-If Swap Sandbox (Stretch) ─────────────────────────────
  swapSimulation: SwapSimulation;
  startSwapSimulation: (original: string, replacement: string) => Promise<void>;
  applySwapSimulation: () => void;
  clearSwapSimulation: () => void;

  // ── Full reset (start a new project) ─────────────────────────────────────
  reset: () => void;
}

// ─── Pipeline state → derived compat values ───────────────────────────────────
const LOADING_STATES: PipelineState[] = [
  'CLARIFYING', 'OPTIONS_GENERATING', 'VALIDATING', 'PLAN_GENERATING',
];
// Only APPROVED state unlocks the overlays — AWAITING_APPROVAL does NOT.
// This enforces Hard Rule 4: the user must explicitly click after reviewing the plan.
const APPROVED_STATES: PipelineState[] = ['APPROVED'];

function derivedClarifyStage(ps: PipelineState): ClarifyStage {
  switch (ps) {
    case 'IDLE':                return 'idle';
    case 'AWAITING_CLARIFY':    return 'waiting_clarification';
    case 'CLARIFYING':          return 'clarifying';
    case 'OPTIONS_PRESENTED':   return 'options_ready';
    case 'VALIDATION_BLOCKED':
    case 'VALIDATED':
    case 'PLAN_GENERATING':
    case 'AWAITING_APPROVAL':
    case 'APPROVED':            return 'option_selected';
    default:                    return 'idle';
  }
}

// ─── Initial state snapshot ──────────────────────────────────────────────────
const INITIAL_STATE = {
  aiProvider: (
    (typeof window !== 'undefined'
      ? localStorage.getItem('cc_provider')
      : null) ?? 'gemini'
  ) as AIProvider,
  pipelineState: 'IDLE' as PipelineState,
  pipelineError: null as PipelineError | null,
  isLoading: false,
  approved: false,
  clarifyStage: 'idle' as ClarifyStage,
  messages: [
    {
      role: 'assistant' as const,
      content: "What are you trying to build today? Describe your idea in plain English — I'll ask a clarifying question if I need more context before proposing options.",
      type: 'text' as const,
    },
  ],
  clarifyContext: [] as { role: 'user' | 'assistant'; content: string }[],
  intent: null,
  options: [] as ArchitectureOption[],
  selectedOptionId: null as string | null,
  validation: null as ValidationResult | null,
  plan: null as MilestonePlan | null,
  currentMilestoneId: null as string | null,
  generatedCode: null as string | null,
  customComponents: [] as ComponentSpec[],
  workspaceState: null as object | null,
  swapSimulation: {
    active: false,
    originalComponent: null,
    replacementComponent: null,
    simulatedOption: null,
    simulatedValidation: null,
    simulatedPlan: null,
  } as SwapSimulation,
};

export const useCircuitStore = create<CircuitStore>((_set, get) => {
  const set = (partial: any) => {
    _set((state: any) => {
      const next = typeof partial === 'function' ? partial(state) : partial;
      if (next.pipelineState !== undefined) {
        return {
          ...next,
          isLoading: LOADING_STATES.includes(next.pipelineState),
          approved: APPROVED_STATES.includes(next.pipelineState),
          clarifyStage: derivedClarifyStage(next.pipelineState),
        };
      }
      return next;
    });
  };

  return {
    ...INITIAL_STATE,

  // ── AI Provider ──────────────────────────────────────────────────────────────
  setAiProvider: (p) => {
    if (typeof window !== 'undefined') localStorage.setItem('cc_provider', p);
    set({ aiProvider: p });
  },

  // ── Pipeline state machine ────────────────────────────────────────────────────
  transitionTo: (state, error) =>
    set({ pipelineState: state, pipelineError: error ?? null }),

  // Compat setters — they update pipelineState where possible
  setIsLoading: (_v) => {
    // no-op: use transitionTo instead; kept for backward compat
  },
  setApproved: (approved) => {
    if (approved) {
      set({ pipelineState: 'APPROVED' });
    }
  },
  setClarifyStage: (s: ClarifyStage) => {
    // Map old ClarifyStage back to PipelineState
    const map: Record<ClarifyStage, PipelineState> = {
      'idle':                 'IDLE',
      'clarifying':           'CLARIFYING',
      'waiting_clarification':'AWAITING_CLARIFY',
      'options_ready':        'OPTIONS_PRESENTED',
      'option_selected':      'VALIDATED',
    };
    set({ pipelineState: map[s] ?? 'IDLE' });
  },

  // ── Chat ──────────────────────────────────────────────────────────────────────
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: INITIAL_STATE.messages }),

  // ── Clarify context ───────────────────────────────────────────────────────────
  appendClarifyContext: (entry) =>
    set((state) => ({ clarifyContext: [...state.clarifyContext, entry] })),
  resetClarifyContext: () => set({ clarifyContext: [] }),

  // ── Module B ─────────────────────────────────────────────────────────────────
  setIntent: (intent) => set({ intent }),

  // ── Module C ─────────────────────────────────────────────────────────────────
  setOptions: (options) => set({ options }),
  setSelectedOptionId: (id) => set({ selectedOptionId: id, generatedCode: null }),

  // ── Module E ─────────────────────────────────────────────────────────────────
  setValidation: (validation) => {
    if (validation) {
      const hasConflicts = validation.violations.some(v => v.severity === 'conflict');
      set({
        validation,
        pipelineState: hasConflicts ? 'VALIDATION_BLOCKED' : 'VALIDATED',
      });
    } else {
      set({ validation });
    }
  },

  // ── Module F ──────────────────────────────────────────────────────────────────────────────────
  setPlan: (plan) =>
    // Plan arriving → AWAITING_APPROVAL, NOT APPROVED.
    // Overlays stay locked until the user clicks “Mark as Reviewed” (APPROVE_FINAL action).
    set({ plan, pipelineState: plan ? 'AWAITING_APPROVAL' : get().pipelineState }),
  setCurrentMilestoneId: (id) => set({ currentMilestoneId: id }),

  // ── Module G ─────────────────────────────────────────────────────────────────
  setGeneratedCode: (generatedCode) => set({ generatedCode }),

  // ── Runtime block registry ────────────────────────────────────────────────────
  addCustomComponent: (spec) =>
    set((state) => ({ customComponents: [...state.customComponents, spec] })),

  // ── Workspace snapshot ────────────────────────────────────────────────────────
  setWorkspaceState: (workspaceState) => set({ workspaceState }),

  // ── What-If Swap Sandbox ──────────────────────────────────────────────────────
  startSwapSimulation: async (original, replacement) => {
    const { selectedOptionId, options, aiProvider } = get();
    const option = options.find((o) => o.id === selectedOptionId);
    if (!option) return;

    set({ pipelineState: 'VALIDATING' });

    const pinMatch = original.match(/\(([^)]+)\)/);
    const suffix = pinMatch ? ` (${pinMatch[1]})` : '';
    const replacementStr = `${replacement}${suffix}`;

    const newComponents = option.components.map((c) =>
      c === original ? replacementStr : c
    );

    const simulatedOption: ArchitectureOption = {
      ...option,
      components: newComponents,
      label: `${option.label} (Swapped: ${replacement})`,
    };

    const simulatedValidation = validateArchitecture(simulatedOption);

    try {
      const resPlan = await fetch('/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Provider': aiProvider,
        },
        body: JSON.stringify({ option: simulatedOption }),
      });
      const milestones = await resPlan.json();
      const simulatedPlan = { milestones };

      set({
        pipelineState: 'VALIDATED',
        swapSimulation: {
          active: true,
          originalComponent: original,
          replacementComponent: replacement,
          simulatedOption,
          simulatedValidation,
          simulatedPlan,
        },
      });
    } catch (e: any) {
      console.error('Error simulating plan:', e);
      set({
        pipelineState: 'VALIDATED',
        swapSimulation: {
          active: true,
          originalComponent: original,
          replacementComponent: replacement,
          simulatedOption,
          simulatedValidation,
          simulatedPlan: null,
        },
      });
    }
  },

  applySwapSimulation: () => {
    const { swapSimulation, options, selectedOptionId } = get();
    if (!swapSimulation.active || !swapSimulation.simulatedOption) return;

    const newOptions = options.map((o) =>
      o.id === selectedOptionId ? swapSimulation.simulatedOption! : o
    );

    set({
      options: newOptions,
      validation: swapSimulation.simulatedValidation,
      plan: swapSimulation.simulatedPlan,
      currentMilestoneId: swapSimulation.simulatedPlan?.milestones[0]?.id ?? null,
      swapSimulation: {
        active: false,
        originalComponent: null,
        replacementComponent: null,
        simulatedOption: null,
        simulatedValidation: null,
        simulatedPlan: null,
      },
    });

    const msgContent = `**What-If Swap Applied** 🔄\n\nReplaced component \`${swapSimulation.originalComponent}\` with \`${swapSimulation.replacementComponent}\`.\n\nProject code, pin mappings, and milestone plan have been updated.`;
    get().addMessage({
      role: 'assistant',
      content: msgContent,
      type: 'text',
    });
  },

  clearSwapSimulation: () => {
    set({
      swapSimulation: {
        active: false,
        originalComponent: null,
        replacementComponent: null,
        simulatedOption: null,
        simulatedValidation: null,
        simulatedPlan: null,
      },
    });
  },

  reset: () => set({ ...INITIAL_STATE }),
  };
});
