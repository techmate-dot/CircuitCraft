# CircuitCraft — Block Editor, Browser Simulator & BOM Feature Spec
**For implementation by GitHub Copilot (agent mode or chat-referenced).**
**Scope: this file specifies NEW/extended functionality only — auto-scaffolding, the universal/component-specific block split, an in-browser simulator, and a Bill of Materials with budget-aware decision support. It assumes the base pipeline (Clarify → Compare-Options → DRC Validation → Plan) and the core `BoardProfile`/`ComponentSpec`/`ValidationResult` types already exist per CircuitCraft_SRS_v2.md and CircuitCraft_Agent_Build_Guide_v2.md. Reference those for anything not redefined here.**

**Time-sensitivity note: today is the submission deadline. Sections are ordered by priority — implement top to bottom, and stop at whatever point you run out of time. Section 5 (simulator) is the most valuable but also the most time-expensive; do not start it until Sections 2–4 are solid.**

---

## 0. Why this matters for scoring (don't skip this context)

The qualifier feedback on this project specifically asked: why is this better than existing block-coding tools like ArduBlock or Snap4Arduino? Verified, citable answers (not just asserted ones):

1. **Neither tool can run without a physically connected board.** ArduBlock requires selecting a connected board through the Arduino IDE before it does anything, and is documented as broken on modern Arduino IDE releases. Snap4Arduino requires Firmata installed on a real board, and even its web version needs a Chrome extension bridging to physical hardware — its maintainers confirm browsers can't reach a serial port without that bridge. **Neither has a no-hardware simulation mode.** Section 5 below closes this gap.
2. **Both tools have fixed, hand-built block libraries.** Their blocks map directly to the Arduino language reference or a fixed protocol; adding support for a new component means writing a new extension in the tool's own source code. CircuitCraft's blocks are generated from a data table (`ComponentSpec`) — adding component support is a data change, not a code change. Section 2 below is what makes this true.
3. **Neither tool reasons about the idea before you start building.** No clarification step, no tradeoff comparison, no electrical validation of what you're about to wire up. CircuitCraft's whole upstream pipeline (already built) is the answer to this — this file just makes sure the block editor actually reflects that reasoning instead of starting from a blank canvas.

Keep these three points in mind while building — they're what should be visibly true in the demo, not just claimed in the submission text.

---

## 1. Block Architecture: Three Tiers, Not One

Don't build a single undifferentiated block library. There are three distinct categories of block, each with a different source of truth:

| Tier | Examples | Source | Generated how |
|---|---|---|---|
| **Universal/structural** | `setup()`, `loop()`, if/else, for/while, math, variables, serial print | Arduino language itself — never changes per project | Use **Blockly's built-in stock blocks** (logic, loops, math, variables categories ship with Blockly for free) — do not hand-build these |
| **Component-specific** | LED control, servo control, sensor read, relay toggle | `ComponentSpec` table | Deterministic template function (`componentSpecToBlockJson`, already specified in SRS v2 FR-7.2) — never LLM-generated block syntax |
| **AI-influenced parameters** | which pin a component block defaults to, what threshold/delay value it starts with | The user's selected `ArchitectureOption` (already DRC-validated) | The block *shape* is still template-generated (Tier 2's rule); only the *pre-filled values* inside it come from the validated option |

**This is the important distinction to hold onto:** "AI-generated blocks" should never mean the LLM writes raw Blockly JSON or raw block-connection logic — that risks malformed, unsafe block definitions, and breaks the determinism that makes your validation layer credible. What's actually AI-influenced is *which* component blocks appear and *what values* they start with — both already decided upstream by the reasoning pipeline and the DRC engine, which this layer simply renders.

---

## 2. Component-Specific Block Generation (extends SRS v2 FR-7.2)

If not already implemented:
- Write `componentSpecToBlockJson(spec: ComponentSpec, category: string): BlocklyJsonBlock` — a pure function. Given any `ComponentSpec`, it returns a valid Blockly JSON block definition (correct `message0`/`args0` shape, an input field for the pin assignment, colour keyed to category).
- Register all current `ComponentSpec` table entries via `Blockly.common.defineBlocksWithJsonArray()` at startup.
- This function must be unit-tested against every entry currently in the component table — a malformed block definition silently breaks the whole workspace, so this is worth testing thoroughly, not just trusting it works.

---

## 3. Auto-Scaffold on Architecture Selection (new requirement)

**Description:** the moment the user selects a validated `ArchitectureOption` (post-DRC), the workspace shall auto-populate — not start from a blank canvas.

**Behavior:**
1. Place one `setup` wrapper block and one `loop` wrapper block (Tier 1, stock-derived) onto the canvas automatically.
2. For each component in the validated option, instantiate its Tier 2 block (already registered per Section 2), pre-filled with its validated pin assignment from the `ArchitectureOption`/`ValidationResult`, and snap it into the appropriate wrapper (pin-mode declarations into `setup`, read/write logic into `loop` — use simple, sensible defaults; this doesn't need to be a fully "correct" program, just a reasonable starting scaffold).
3. After auto-population, the user can freely drag in additional blocks from any of the four categories (Sensors/Actuators/Power/Control) or Blockly's stock categories, rearrange, delete, or reconnect anything.

**Acceptance criteria:** selecting an option results in a populated canvas within a couple seconds, not an empty workspace; every block visible came from either the stock library or `componentSpecToBlockJson` — never inline-written.

**Live sync (already specified in SRS v2 FR-7.4 — reaffirmed here):** any block change, whether from auto-scaffold or manual editing, must regenerate the Arduino code in the Monaco panel via `workspace.addChangeListener()`. This must already be true before you touch Section 5 below — the simulator depends on this same change-listener pattern.

---

## 4. Manual Editing Disclosure (reaffirms SRS v2 FR-7.5)

Monaco remains editable for the user's own tweaks. The UI must disclose that manual code edits don't parse back into blocks and will be overwritten if blocks change again afterward. No change needed here if already implemented — just confirm it still holds once auto-scaffold (Section 3) is in place, since a freshly auto-populated canvas is exactly the moment a user is most likely to also hand-edit the code.

---

## 5. Browser Simulation Layer — Scope This Carefully

**What this is NOT:** real AVR/ESP32 instruction-level emulation, and not literal execution of the generated Arduino C++. Building a true hardware emulator in remaining hackathon time is not realistic, and attempting it risks consuming all remaining time without a working result. Do not attempt this.

**What this IS:** a parallel, lightweight **behavioral simulation** driven by the same block tree that generates the Arduino code — using Blockly's own JavaScript generator (a second generator alongside the Arduino one, both reading the same blocks) to drive a visual canvas showing simulated component behavior (an LED block visually lighting up, a servo block's arm rotating, a sensor block showing a simulated reading). This is genuinely achievable in remaining time and is arguably a stronger demo moment than raw serial text output would be.

**Implementation:**
1. Add a second Blockly generator object (e.g. `simJsGenerator`) with one `forBlock['type']` function per block type — same pattern as the Arduino generator, just emitting JS calls against a small mock hardware API instead of C++.
2. Mock hardware API surface (keep this small): `__sim.digitalWrite(pin, value)`, `__sim.analogRead(pin)` (returns a simulated value, e.g. from `ComponentSpec.simulation.defaultSimulatedValue` if you add that field — see Section 7), `__sim.delay(ms)` (does **not** block — instead advances simulated time and yields control, so the visual updates instead of freezing), `__sim.tone(pin, freq, duration)`.
3. **Execute the generated JS inside a sandboxed `<iframe sandbox="allow-scripts">`** (no `allow-same-origin`), communicating with the parent page only via `postMessage`. The only globals exposed inside that sandbox are the `__sim.*` functions above — no `fetch`, no `document`, no access to the parent window or any network/storage API.
4. The parent page listens for `__sim.*` calls relayed via `postMessage` and updates a simple visual (SVG/canvas icon per component: lit/unlit LED, rotated servo arm, etc.) accordingly.
5. A "Run in Browser" button triggers this: generate JS from the current block tree → load into the sandboxed iframe → execute → render the visual updates as they're emitted.

**Hard rule:** the JS executed in the sandbox must always be generated deterministically from the validated block tree via the generator in step 1 — never raw text from an LLM, never user-typed text from Monaco (per Section 4, Monaco edits don't feed back into execution either). This keeps the same LLM-proposes/deterministic-engine-executes boundary that the rest of the system already enforces, applied to code execution instead of just validation.

**Acceptance criteria:** clicking "Run in Browser" on the auto-scaffolded canvas (Section 3) visibly animates at least one component's simulated behavior (e.g. an LED blinking) without freezing the page, and without any network request leaving the sandboxed context.

**If you're running low on time:** a working simulation of just one block type (e.g. digital output / LED) is a legitimate, honest stopping point — say so directly rather than implementing a partial version of all block types that looks broken. One block type working cleanly demos better than five working unreliably.

---

## 6. Bill of Materials + Budget/Location Decision Support (extends SRS v2 FR-11)

**Deliberate scope decision:** unlike the first-step output rule elsewhere in this system, the BOM should cover **every component across the full milestone plan**, not just milestone 1 — "what do I need to buy" is naturally a whole-project question. This is an intentional, reasoned exception to the milestone-1-only scoping rule, not an oversight.

**What this is NOT:** a live price-comparison or inventory-checking engine against real retailers. Building that requires either scraping or a paid API, and introduces exactly the kind of live external dependency that's risky to add this close to a deadline (same reasoning as the DRC-data discussion earlier — don't add a live API today). **What this IS:** a static, curated reference layer with client-side budget/location filtering logic — same philosophy as the component spec table, applied to sourcing instead of electrical safety.

**Data needed (static, curated — see Section 7 for the type):** for each component already in your spec table, add an approximate local-currency cost range and one or two general sourcing notes (e.g. a known electronics market/area, plus a general online option). Ranges, not invented precise figures — say "approximate" in the UI.

**Decision-support logic (pure client-side function, no AI call):**
1. Sum the cost range across all BOM entries for the current plan.
2. If the user has entered an optional budget figure, compare the total against it and flag the BOM as within/near/over budget.
3. If a specific component is the main driver of going over budget, look for a cheaper alternative **within the same category** (Sensors/Actuators/Power/Control) in the existing `ComponentSpec` table, and check whether swapping to it would still pass DRC validation (reuse the existing What-If Swap logic from FR-10 — don't build a second validation path).
4. If a DRC-compatible cheaper alternative exists, surface it as a suggestion the user can act on via the existing swap control — don't auto-swap.

**Location field:** keep this simple — a small fixed set of options (e.g. "Lagos," "Other Nigeria," "Outside Nigeria") used only to select which static sourcing-note variant to display, not a live geolocation lookup.

**Acceptance criteria:** the BOM view shows every plan component with a cost range and sourcing note; entering a budget below the total visibly flags it and surfaces at least one DRC-compatible cheaper alternative where one exists in the table.

---

## 7. Data Contract Additions

These extend, not replace, the types in CircuitCraft_SRS_v2.md Section 5.

```ts
// Add to ComponentSpec
type ComponentSpec = {
  // ...existing fields from SRS v2...
  simulation?: {
    visual: "led" | "servo_arm" | "buzzer_wave" | "generic_readout";
    defaultSimulatedValue?: number | boolean; // used by __sim.analogRead/digitalRead mocks
  };
  estCostRangeLocal?: { min: number; max: number; currency: string }; // e.g. NGN
  sourcingNotes?: { region: "lagos" | "other_nigeria" | "outside_nigeria"; note: string }[];
};

type BlockScaffold = {
  componentBlocks: { componentName: string; blockId: string }[];
  wrapperBlocks: ("setup" | "loop")[];
};

type BOMEntry = {
  componentName: string;
  quantity: number;
  estCostRangeLocal: { min: number; max: number; currency: string };
  sourcingNote: string;
};

type BudgetCheckResult = {
  totalEstCost: { min: number; max: number; currency: string };
  status: "within_budget" | "near_budget" | "over_budget" | "no_budget_set";
  suggestedSwap?: { fromComponent: string; toComponent: string; estCostRangeLocal: { min: number; max: number; currency: string } };
};
```

---

## 8. Hard Rules (carried over + new for this scope)

1. No LLM call ever writes raw Blockly JSON or raw block-connection logic — only the deterministic template function does (Section 1, Section 2).
2. The simulator (Section 5) only ever executes JS generated deterministically from the validated block tree — never LLM output, never raw Monaco text.
3. The simulator must run inside a sandboxed iframe (`allow-scripts` only) with no network, storage, or parent-window access — this is non-negotiable regardless of time pressure.
4. The BOM/budget logic (Section 6) is pure client-side computation against static data — no live pricing/inventory API calls.
5. The BOM's full-plan scope (Section 6) is the one deliberate exception to the milestone-1-only output rule elsewhere in the system — don't generalize this exception to other features without good reason.
6. Auto-scaffold (Section 3) populates the canvas automatically but never auto-finalizes — the existing approval gate (SRS v2 FR-8) still governs when output is treated as final.

---

## 9. Acceptance Checklist

- [ ] Stock Blockly blocks (logic/loops/math) are reused for universal constructs — not hand-built.
- [ ] Every component-specific block is generated via `componentSpecToBlockJson`, unit-tested against the full current component table.
- [ ] Selecting a validated architecture option auto-populates the canvas with setup/loop wrappers and pre-filled component blocks within a couple seconds.
- [ ] Every block change (auto-scaffold or manual) regenerates the Monaco code panel live.
- [ ] "Run in Browser" executes sandboxed, deterministically-generated JS and visibly animates at least one component's simulated behavior.
- [ ] No network/storage access is reachable from inside the simulator sandbox.
- [ ] BOM view lists every component across the full plan with a cost range and sourcing note.
- [ ] Entering a budget that's exceeded surfaces at least one DRC-compatible cheaper alternative, where one exists.

---

## 10. Priority Order Given Remaining Time

1. **Section 2 + 3 (component blocks + auto-scaffold)** — highest value, most achievable, most directly answers the qualifier's "why is this better than ArduBlock" gap.
2. **Section 6 (BOM/budget)** — cheap to build, entirely static/client-side, low risk.
3. **Section 5 (simulator)** — highest demo value but highest time cost. Time-box it. A single working block type beats a half-working full set. If you run out of time here, the auto-scaffolded, live-synced block editor from Sections 2–3 is still a strong, honest demo on its own.
