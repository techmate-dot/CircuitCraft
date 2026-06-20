# CircuitCraft — AI Agent Build Guide (v2)
**For use by coding agents (e.g. Google Antigravity) building this project.**
**Read this file in full before writing any code. It is the source of truth for scope, priority, and constraints. Supersedes v1.**

USAII Global AI Hackathon 2026 · Challenge 3 · Undergraduate Track · Direction B — Zero-to-One Builder
**References:** CircuitCraft_SRS_v2.md (canonical for data shapes, rule IDs, and acceptance criteria — this guide summarizes it in agent-actionable form, the SRS is authoritative if they ever conflict)

---

## 0. What changed since v1 — migration work required

If prior build phases already implemented a flat `ComponentSpec`-only table and an unstructured conflicts/warnings validation result, **that code needs to migrate, not be left as-is.** Specifically:

1. The component model is now two-tier: a typed `BoardProfile` (board pins, capabilities, current limits, reserved pins, logic voltage) plus `ComponentSpec` (unchanged in spirit, extended with `i2c_default_address` and `requires_pull_resistor`). See Section 5.2.
2. The validation engine's output is now rule-ID-tagged (`RuleViolation[]` with `ruleId`, `severity`, `message`) instead of flat `conflicts`/`warnings` string arrays. Any renderer reading the old shape needs updating.
3. Every LLM call (Clarify, Compare-Options, Plan) now requires runtime schema validation with a retry-then-error path (Section 5.1a, new). If this doesn't exist yet, treat it as missing must-have scope, not optional hardening.
4. The pipeline now has a formally named state machine (Section 3) that should be driving the Zustand store's top-level state field, replacing any ad-hoc boolean flags.

If you're prompting Antigravity for the next phase, point it at this section explicitly so it audits existing code against the new shapes rather than assuming a clean slate.

---

## 1. The Evaluation Rubric — treat this as the objective function

| Dimension | Weight | What is being judged |
|---|---|---|
| **AI Reasoning** | **30%** | Is the AI's use justified? LLM vs. rules vs. automation — reasoned, not asserted. |
| **Solution Design** | 25% | Coherent system: clear data → AI → output pipeline. |
| **Problem Understanding** | 20% | Clear decision context and specific user; real constraints acknowledged. |
| **Impact & Insight** | 15% | Meaningfully improves decision-making or execution. |
| **Responsible AI** | 10% | Risks identified and concretely mitigated. |

AI Reasoning + Solution Design = 55% of the score, and both depend entirely on the reasoning pipeline and the DRC engine working end-to-end with visible intermediate steps. Renderer polish is the correct thing to simplify under time pressure — the reasoning and validation layers are not.

**Never let the build:** generate content without visibly reasoning through tradeoffs first; present AI output as a "correct answer" rather than a decision input; lack a clear moment where the user decides something; describe any component as "machine learning that analyzes patterns" without naming the actual model and mechanism.

---

## 2. Problem, User, Decision Moment

**User:** a Nigerian undergraduate, secondary-school robotics club member, or self-taught hobbyist with a hardware idea and no mentor or lab to verify wiring against.

**Constraint that makes this non-generic:** a wrong pin assignment or unvalidated power draw can damage a real, often slow-to-replace component.

**The decision moment:** after the system proposes two distinct architecture options, the user picks one via a real click. This — not the code generation — is what's graded.

---

## 3. System Architecture & Pipeline State Machine

```
Idea Input → Clarify [LLM, schema-validated] → Compare-Options [LLM, schema-validated, DECISION POINT]
   → DRC Validation [deterministic, Domain layer] ← BoardProfile + ComponentSpec
   → Milestone Plan [LLM, schema-validated] → First-Step Render [templated, not generative]
   → Human Approval [UI gate]
```

**Pipeline states** (this should be a single enum field in the Zustand store, not scattered booleans): `IDLE → CLARIFYING → OPTIONS_GENERATING → OPTIONS_PRESENTED → VALIDATING → (VALIDATION_BLOCKED | VALIDATED) → PLAN_GENERATING → PLAN_READY → RENDERING → AWAITING_APPROVAL → APPROVED`. Transitions occur only via named actions (`SUBMIT_IDEA`, `SELECT_OPTION`, `SWAP_COMPONENT`, `ACK_WARNINGS`, `APPROVE`) — never automatically. Any LLM-calling state can fall into a retry/error path per Section 5.1a.

**Layered architecture (enforce this dependency direction strictly):**

| Layer | Responsibility | May call LLM? |
|---|---|---|
| Presentation | React components, Zustand selectors — rendering only | No |
| Orchestration | One use-case function per pipeline step | Calls Infrastructure |
| Domain/Rules | `BoardProfile`, `ComponentSpec`, the DRC rule catalog, pure validation functions | **Never** — zero I/O, fully unit-testable offline |
| Infrastructure | LLM API client, schema validators, retry/backoff wrapper, env config | Yes — the only layer permitted network I/O |

**Why this split (bake into the AI Architecture Explanation submission field, not just code comments):** fixed block-coding tools require the user to already know what they need; they don't accept open-ended language and don't reason about idea-specific risk. An LLM handles the ambiguous-language-in stage. A deterministic rules engine handles the safety-critical validation stage because that step must be reliable and explainable every time, not probabilistic. The LLM proposes; the rules engine disposes.

---

## 4. Hard Rules — apply to every module, every phase

1. **No custom-trained model, anywhere.** General-purpose LLM via API only.
2. **The DRC engine (Section 5.2) must never call an LLM.** Pure, deterministic, same input → same output every time.
3. **Never silently auto-correct a violation.** Every conflict or warning is surfaced with its rule ID in user-facing language.
4. **Never auto-advance past a decision point.** Option selection and final approval both require an explicit click mapped to a named state transition.
5. **No mock/placeholder data in the final integrated build.** Acceptable only during isolated module development; must be fully replaced before integration is complete.
6. **Every AI-generated suggestion needs a one-line "why."**
7. **No API key hardcoded anywhere.** Environment variables only, with `.env.example`.
8. **First-step output is scoped to milestone 1 only.**
9. **Code/diagram generation from validated data is templated substitution, never free generation.**
10. **(New) Every raw LLM response must pass runtime schema validation before reaching the Orchestration or Domain layer.** On failure: one retry, then an explicit user-visible error state. Never a silent pass-through of malformed data.
11. **(New) Every validation message must carry a rule ID** (e.g. `VR-001`) traceable to the catalog in Section 5.2 — no unattributed "something's wrong" messages.

---

## 5. Build Directives by Module (ordered by rubric contribution)

### 5.1 Reasoning pipeline — serves AI Reasoning (30%) + Problem Understanding (20%)
- Clarify step: extract a structured `IntentObject`; surface a clarifying question or stated assumption visibly before anything else happens.
- Compare-Options step: produce exactly two architecture options with genuinely different, named tradeoffs (cost, portability, complexity, power). Require a real click; never auto-select.

### 5.1a LLM Output Contract Enforcement — serves Solution Design (25%) + Responsible AI (10%) — NEW, cross-cutting
- Every one of the three LLM call sites (Clarify, Compare-Options, Plan) must validate its raw response against a runtime schema (e.g. Zod) mirroring the corresponding TypeScript type before any downstream code touches it.
- On validation failure: retry once with an error-correction prompt. On a second failure: transition the pipeline state to an explicit error state and show the user a visible, plain-language message — never proceed with partial or guessed data.
- This is must-have scope, not optional hardening — build it alongside whichever LLM call site you're touching, don't defer it to a "polish later" pass.

### 5.2 Board/component domain model + DRC validation engine — serves AI Reasoning (30%) + Responsible AI (10%)
- Build a typed `BoardProfile` (at least one board, e.g. Arduino Uno or ESP32 DevKit) describing every pin's capabilities, current limit, reserved status, plus the board's logic voltage and total current budget.
- Build/extend the `ComponentSpec` table (10–15 components) with required pin capabilities, voltage, current draw, driver requirement, and where relevant an I2C default address and pull-resistor requirement.
- Implement validation as a **named, numbered Design Rule Check (DRC) catalog** — not an unenumerated list of checks. Minimum rule set:

| Rule ID | Checks | Severity |
|---|---|---|
| VR-001 | No two components share a pin | conflict |
| VR-002 | Component's required pin capabilities are a subset of the assigned pin's capabilities | conflict |
| VR-003 | Component voltage matches board logic voltage, or a level-shifter is present | conflict |
| VR-004 | Component current draw ≤ assigned pin's max current | conflict |
| VR-005 | Total current draw ≤ board's total current budget | warning at 80–100%, conflict if exceeded |
| VR-006 | Component not assigned to a reserved pin (UART/USB/boot-mode) | conflict |
| VR-007 | No two I2C components share a default address unless remappable | conflict, or warning if remappable |
| VR-008 | A `requires_driver` component has a driver/interface component present | warning |
| VR-009 | A `requires_pull_resistor` component has an available internal pull-up or external resistor noted | warning |

- Every violation returned must include `ruleId`, `severity`, `message`, and the affected component names — never a bare string.
- Unit tests: at minimum one passing case and one triggering case per rule above.

### 5.3 Milestone plan — serves Solution Design (25%) + Impact & Insight (15%)
- Given a `VALIDATED` option, generate 4–5 milestones; render as a visual flow. Milestone 1 must be unambiguous.

### 5.4 First-step output renderers — serves Solution Design (25%) + Impact & Insight (15%)
- Mount a real Blockly workspace via `Blockly.inject()`, themed with CircuitCraft's obsidian/gold palette.
- Convert each `ComponentSpec` to a Blockly JSON block definition via a deterministic template function; register via `Blockly.common.defineBlocksWithJsonArray()`.
- Toolbox: exactly four permanent categories (Sensors, Actuators, Power, Control), each via `workspace.registerToolboxCategoryCallback()` returning only blocks for components in the current validated option.
- Custom Arduino code generator (Blockly has none built in) with one `forBlock['type']` function per block type; Monaco regenerates on every block change via `workspace.addChangeListener()`.
- Monaco is editable; disclose that manual edits don't parse back into blocks.

### 5.5 Approval gate — serves Responsible AI (10%)
- Approval control disabled until any present `warning`-severity violations are acknowledged. Nothing is labeled final before activation.

### 5.6 Stretch (only after 5.1–5.5 are solid end-to-end) — serves Impact & Insight (15%) + Problem Understanding (20%)
- What-if component swap: substitute a component, re-run validation + plan, show before/after with rule IDs.
- Local-context layer: approximate local-currency cost and sourcing/power-resilience notes per component.

---

## 6. Acceptance Checklist — verify before calling any phase "done"

- [ ] Clarify renders a visible question/assumption before any option appears.
- [ ] Two distinct, tradeoff-bearing options render; selection requires a real click.
- [ ] DRC validation runs with zero AI calls; every violation carries a rule ID.
- [ ] At least one deliberately seeded violation is caught and shown in plain language during a live run.
- [ ] At least one deliberately malformed LLM response triggers the retry-then-error path, not a silent pass-through or crash.
- [ ] Milestone plan shows 4–5 distinct stages; milestone 1 is the only one with generated output.
- [ ] Rendered diagram/code reflects real validated data — no leftover mock values.
- [ ] Approval control is genuinely disabled until warnings are acknowledged.
- [ ] No code comment, UI string, or submission field implies a custom-trained model exists.
- [ ] No API key hardcoded anywhere.
- [ ] Zustand store's pipeline state matches the named state machine in Section 3, not ad-hoc booleans.

---

## 7. Open Questions to Ask the User, Not Assume

- Which LLM provider/API (affects SDK choice, key naming in `.env.example`).
- Which schema-validation library (Zod is suggested, not mandated).
- Exact component list beyond the minimum 10–15 named in Section 5.2.
- Whether stretch features (Section 5.6) are in scope given remaining time.
