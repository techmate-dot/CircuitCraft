// ─── Navigation / UI tabs ────────────────────────────────────────────────────
export type NavTab = 'assistant' | 'logic' | 'hardware' | 'debug';
export type RightTab = 'code' | 'mapping' | 'guide';
export type CenterView = 'schematic' | 'blocks' | 'plan';

// ─── AI Provider ─────────────────────────────────────────────────────────────
export type AIProvider = 'gemini' | 'openai' | 'anthropic';

// ─── Pipeline State Machine ───────────────────────────────────────────────────
// This is the SINGLE source of truth for where the user is in the workflow.
// No scattered boolean flags. Transitions only via named actions.
//
// Allowed transitions:
//   IDLE              → CLARIFYING         (SUBMIT_IDEA)
//   CLARIFYING        → OPTIONS_GENERATING  (clarify returned 0 missing_info)
//   CLARIFYING        → AWAITING_CLARIFY    (clarify returned missing_info)
//   AWAITING_CLARIFY  → CLARIFYING          (SUBMIT_IDEA — follow-up turn)
//   OPTIONS_GENERATING → OPTIONS_PRESENTED  (compare call succeeded)
//   OPTIONS_PRESENTED → VALIDATING          (SELECT_OPTION)
//   VALIDATING        → VALIDATION_BLOCKED  (DRC found conflict-severity violations)
//   VALIDATING        → VALIDATED           (DRC passed — zero conflicts)
//   VALIDATED          → PLAN_GENERATING      (APPROVE — after warnings acknowledged)
//   VALIDATION_BLOCKED → (swap component or restart)
//   PLAN_GENERATING    → AWAITING_APPROVAL    (plan LLM call succeeded)
//   AWAITING_APPROVAL  → APPROVED             (APPROVE_FINAL — explicit user click on plan)
//   Any LLM state      → ERROR                (schema validation failed twice)
//   ERROR              → IDLE                 (user clicks retry / reset)

export type PipelineState =
  | 'IDLE'
  | 'CLARIFYING'
  | 'AWAITING_CLARIFY'
  | 'OPTIONS_GENERATING'
  | 'OPTIONS_PRESENTED'
  | 'VALIDATING'
  | 'VALIDATION_BLOCKED'
  | 'VALIDATED'
  | 'PLAN_GENERATING'
  | 'PLAN_READY'
  | 'RENDERING'
  | 'AWAITING_APPROVAL'   // plan arrived — waiting for explicit user click
  | 'APPROVED'
  | 'ERROR';

/** Named transition actions — the only way to move between states */
export type PipelineAction =
  | 'SUBMIT_IDEA'
  | 'SELECT_OPTION'
  | 'SWAP_COMPONENT'
  | 'ACK_WARNINGS'
  | 'APPROVE'         // approve architecture → kicks off plan generation
  | 'APPROVE_FINAL'   // explicit user click after reviewing the plan → APPROVED
  | 'RESET';

/** A pipeline error — always visible to the user, never silently swallowed */
export interface PipelineError {
  stage: string;       // which pipeline step failed
  message: string;     // plain-language message for the user
  retryable: boolean;  // whether a retry button should be shown
}

// ─── ClarifyStage — kept as compat alias for UI components ───────────────────
// Maps from old ad-hoc strings → PipelineState for gradual migration.
// New code should read pipelineState directly.
export type ClarifyStage =
  | 'idle'
  | 'waiting_clarification'
  | 'clarifying'
  | 'options_ready'
  | 'option_selected';

// ─── Data contracts (must match server-side schemas exactly) ──────────────────

/** One clarifying question with clickable answer chips */
export type ClarifyingQuestion = {
  question: string;
  suggestedAnswers: string[];
};

/** Output of the Clarify LLM call */
export type IntentObject = {
  goal: string;
  components_mentioned: string[];
  missing_info: ClarifyingQuestion[];
  assumptions: string[];
};

/** One architecture proposal returned by the Compare LLM call */
export type ArchitectureOption = {
  id: string;
  label: string;            // e.g. "Battery-powered ESP32"
  components: string[];
  tradeoffs: {
    cost: string;
    portability: string;
    complexity: string;
    power: string;
  };
  summary: string;
};

/** One milestone in the plan */
export type MilestonePlan = {
  milestones: {
    id: string;
    title: string;
    description: string;
    depends_on: string | null;
  }[];
};

/**
 * Resolved pin assignment — derived from an ArchitectureOption after validation.
 * Pin numbers come from the validated component strings, never directly from the LLM.
 */
export type PinAssignment = {
  component: string;
  rawLabel: string;
  pin: string;
  pinType: 'digital' | 'analog' | 'pwm' | 'i2c' | 'interrupt';
  role: 'input' | 'output' | 'bidirectional' | 'power';
};

// Note: ComponentSpec, BoardProfile, ValidationResult, and RuleViolation live in
// src/data/components.ts — the Domain layer owns them.
