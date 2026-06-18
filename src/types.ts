// ─── Navigation / UI tabs ────────────────────────────────────────────────────
export type NavTab = 'assistant' | 'logic' | 'hardware' | 'debug';
export type RightTab = 'code' | 'mapping' | 'guide';
export type CenterView = 'schematic' | 'blocks' | 'plan';

// ─── AI Provider ─────────────────────────────────────────────────────────────
export type AIProvider = 'gemini' | 'openai' | 'anthropic';

// ─── Clarify stage (drives the two-turn flow gate) ───────────────────────────
// idle               → user has not submitted anything yet
// waiting_clarification → LLM returned missing_info; we are waiting for user reply
// clarifying         → second (or later) clarify call is in flight
// options_ready      → compare call returned 2 options; waiting for user click
// option_selected    → user clicked one option; comparison locked
export type ClarifyStage =
  | 'idle'
  | 'waiting_clarification'
  | 'clarifying'
  | 'options_ready'
  | 'option_selected';

// ─── Data contracts (must match server-side schemas exactly) ─────────────────

/** Output of the Clarify LLM call */
export type IntentObject = {
  goal: string;
  components_mentioned: string[];
  missing_info: string[];   // what the user did not specify
  assumptions: string[];    // what the AI is assuming instead of asking
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

/** One milestone in the plan (used by Module F, scaffolded here for type safety) */
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
 * This is the contract consumed by BlocksCanvas and the Monaco code generator.
 * Pin numbers come from the validated component strings, never directly from the LLM.
 */
export type PinAssignment = {
  component: string;       // display name, e.g. "PIR_Sensor"
  rawLabel: string;        // original component string, e.g. "PIR_Sensor (Pin GPIO13)"
  pin: string;             // resolved pin name, e.g. "GPIO13"
  pinType: 'digital' | 'analog' | 'pwm' | 'i2c' | 'interrupt';
  role: 'input' | 'output' | 'bidirectional' | 'power';
};

// Note: ComponentSpec and ValidationResult live in src/data/components.ts
// because that module owns the deterministic validation engine.
// They are intentionally NOT defined here to keep the AI/LLM boundary sharp.
