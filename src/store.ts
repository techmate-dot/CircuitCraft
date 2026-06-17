import { create } from 'zustand';
import type { IntentObject, ArchitectureOption, MilestonePlan } from './types';
import type { ValidationResult } from './data/components';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'clarify' | 'options' | 'validation' | 'plan';
}

interface CircuitStore {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  
  intent: IntentObject | null;
  setIntent: (intent: IntentObject | null) => void;
  
  options: ArchitectureOption[];
  setOptions: (options: ArchitectureOption[]) => void;
  
  selectedOptionId: string | null;
  setSelectedOptionId: (id: string | null) => void;
  
  validation: ValidationResult | null;
  setValidation: (result: ValidationResult | null) => void;
  
  plan: MilestonePlan | null;
  setPlan: (plan: MilestonePlan | null) => void;
  
  currentMilestoneId: string | null;
  setCurrentMilestoneId: (id: string | null) => void;
  
  approved: boolean;
  setApproved: (approved: boolean) => void;
}

export const useCircuitStore = create<CircuitStore>((set) => ({
  messages: [{ role: 'assistant', content: 'What are you trying to build today?', type: 'text' }],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  
  intent: null,
  setIntent: (intent) => set({ intent }),
  
  options: [],
  setOptions: (options) => set({ options }),
  
  selectedOptionId: null,
  setSelectedOptionId: (id) => set({ selectedOptionId: id }),
  
  validation: null,
  setValidation: (validation) => set({ validation }),
  
  plan: null,
  setPlan: (plan) => set({ plan }),
  
  currentMilestoneId: null,
  setCurrentMilestoneId: (id) => set({ currentMilestoneId: id }),
  
  approved: false,
  setApproved: (approved) => set({ approved }),
}));
