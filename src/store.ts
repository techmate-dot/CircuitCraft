import { create } from 'zustand';
import type {
  IntentObject,
  ArchitectureOption,
  MilestonePlan,
  ClarifyStage,
  AIProvider,
} from './types';
import type { ValidationResult } from './data/components';
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
   *   validation   → ValidationCard — conflicts + warnings + approval gate
   *   plan         → plain text pointing to Plan canvas
   */
  type?: 'text' | 'clarify' | 'options' | 'validation' | 'plan';
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

  // ── Global loading flag ───────────────────────────────────────────────────
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;

  // ── Chat history ──────────────────────────────────────────────────────────
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;

  // ── Two-turn clarify flow ─────────────────────────────────────────────────
  /**
   * clarifyStage gates the reasoning loop:
   *   idle                 → user has not submitted anything
   *   waiting_clarification → LLM returned missing_info; waiting for user reply
   *   clarifying           → second clarify call in flight
   *   options_ready        → compare call returned 2 options; waiting for click
   *   option_selected      → user clicked; comparison locked
   */
  clarifyStage: ClarifyStage;
  setClarifyStage: (s: ClarifyStage) => void;

  /**
   * Conversation history sent back to the LLM on subsequent clarify turns.
   * Grows with each user/assistant exchange so the LLM has full context.
   */
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

  // ── Module H: Human approval gate ────────────────────────────────────────
  approved: boolean;
  setApproved: (approved: boolean) => void;

  generatedCode: string | null;
  setGeneratedCode: (code: string | null) => void;

  // ── Module I: What-If Swap Sandbox (Stretch) ─────────────────────────────
  swapSimulation: SwapSimulation;
  startSwapSimulation: (original: string, replacement: string) => Promise<void>;
  applySwapSimulation: () => void;
  clearSwapSimulation: () => void;

  // ── Full reset (start a new project) ─────────────────────────────────────
  reset: () => void;
}

// ─── Initial state snapshot (used by reset()) ────────────────────────────────
const INITIAL_STATE = {
  aiProvider: (
    (typeof window !== 'undefined'
      ? localStorage.getItem('cc_provider')
      : null) ?? 'gemini'
  ) as AIProvider,
  isLoading: false,
  messages: [
    {
      role: 'assistant' as const,
      content: "What are you trying to build today? Describe your idea in plain English — I'll ask a clarifying question if I need more context before proposing options.",
      type: 'text' as const,
    },
  ],
  clarifyStage: 'idle' as ClarifyStage,
  clarifyContext: [] as { role: 'user' | 'assistant'; content: string }[],
  intent: null,
  options: [],
  selectedOptionId: null,
  validation: null,
  plan: null,
  currentMilestoneId: null,
  approved: false,
  generatedCode: null,
  swapSimulation: {
    active: false,
    originalComponent: null,
    replacementComponent: null,
    simulatedOption: null,
    simulatedValidation: null,
    simulatedPlan: null
  } as SwapSimulation,
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const useCircuitStore = create<CircuitStore>((set, get) => ({
  ...INITIAL_STATE,

  setAiProvider: (p) => {
    if (typeof window !== 'undefined') localStorage.setItem('cc_provider', p);
    set({ aiProvider: p });
  },

  setIsLoading: (v) => set({ isLoading: v }),

  messages: INITIAL_STATE.messages,
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: INITIAL_STATE.messages }),

  clarifyStage: INITIAL_STATE.clarifyStage,
  setClarifyStage: (s) => set({ clarifyStage: s }),

  clarifyContext: INITIAL_STATE.clarifyContext,
  appendClarifyContext: (entry) =>
    set((state) => ({ clarifyContext: [...state.clarifyContext, entry] })),
  resetClarifyContext: () => set({ clarifyContext: [] }),

  intent: null,
  setIntent: (intent) => set({ intent }),

  options: [],
  setOptions: (options) => set({ options }),

  selectedOptionId: null,
  setSelectedOptionId: (id) => set({ selectedOptionId: id, generatedCode: null }),

  validation: null,
  setValidation: (validation) => set({ validation }),

  plan: null,
  setPlan: (plan) => set({ plan }),

  currentMilestoneId: null,
  setCurrentMilestoneId: (id) => set({ currentMilestoneId: id }),

  approved: false,
  setApproved: (approved) => set({ approved }),

  generatedCode: null,
  setGeneratedCode: (generatedCode) => set({ generatedCode }),

  swapSimulation: INITIAL_STATE.swapSimulation,

  startSwapSimulation: async (original, replacement) => {
    const { selectedOptionId, options, aiProvider } = get();
    const option = options.find((o) => o.id === selectedOptionId);
    if (!option) return;

    set({ isLoading: true });

    // Build replacement component name preserving pin parenthesis if any
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

    // Run deterministic validation locally
    const simulatedValidation = validateArchitecture(simulatedOption);

    // Call API (or mock fallback) for new plan
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

    set({ isLoading: false });
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
}));
