/**
 * CircuitCraft API server
 *
 * Routes /api/clarify, /api/compare, and /api/plan to whichever AI provider
 * is requested. Provider is determined by the X-AI-Provider request header,
 * falling back to the AI_PROVIDER environment variable, then to "gemini".
 *
 * IMPORTANT: This app uses general-purpose LLM APIs (Gemini, OpenAI, Claude)
 * plus a deterministic rules engine for validation. No custom-trained ML model
 * is used anywhere in this stack.
 *
 * Section 5.1a compliance: Every LLM response is validated against a Zod schema
 * before reaching any downstream code. On failure: one retry with an
 * error-correction prompt. On a second failure: explicit error payload returned.
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';

// ─── Provider SDK imports ─────────────────────────────────────────────────────
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ─── Provider instances (lazy — only the selected provider is actually called) ─
const geminiClient = (apiKey?: string) =>
  new GoogleGenAI({ apiKey: apiKey ?? process.env.GEMINI_API_KEY ?? '' });

const openaiClient = () =>
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });

const anthropicClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

// ─── Gemini model + key fallback chain ───────────────────────────────────────
// Models: primary → fallback (tried in order for each key slot)
// Keys:   GEMINI_API_KEY → GEMINI_API_KEY_2 (second key tried before switching model)
// Quota strategy: 429 exhausts the current key → try next key → then next model
const GEMINI_PRIMARY = 'gemini-3.5-flash';
const GEMINI_FALLBACK = 'gemini-3.1-flash-lite';

function geminiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
  ].filter(Boolean) as string[];
}

function isOverloadError(e: any): boolean {
  const status = e?.status ?? e?.statusCode ?? e?.response?.status;
  const msg: string = (e?.message ?? '').toLowerCase();
  return status === 503 || msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable');
}

function isQuotaError(e: any): boolean {
  const status = e?.status ?? e?.statusCode ?? e?.response?.status;
  const msg: string = (e?.message ?? '').toLowerCase();
  return status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate_limit');
}

async function geminiWithFallback(params: { contents: string; config: object }): Promise<string> {
  const keys = geminiKeys();
  if (keys.length === 0) throw new Error('No Gemini API key configured. Add GEMINI_API_KEY to your .env file.');

  const MAX_RETRIES = 2;
  const BACKOFF_MS = 1500;
  let lastError: any;

  // Outer: try each model in order
  for (const model of [GEMINI_PRIMARY, GEMINI_FALLBACK]) {
    // Inner: try each key before moving to the next model
    for (const [ki, apiKey] of keys.entries()) {
      const ai = geminiClient(apiKey);
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await ai.models.generateContent({ model, ...params });
          if (model !== GEMINI_PRIMARY) console.warn(`[gemini] ⚠️  Fell back to model ${model}`);
          if (ki > 0) console.warn(`[gemini] ⚠️  Using backup API key #${ki + 1}`);
          return result.text ?? '{}';
        } catch (e: any) {
          lastError = e;
          if (isQuotaError(e)) {
            // Daily quota on this key — move to the next key immediately, no retries
            console.warn(`[gemini] 429 quota on model=${model} key#${ki + 1} — trying next key`);
            break;
          }
          if (isOverloadError(e) && attempt < MAX_RETRIES - 1) {
            console.warn(`[gemini] 503 on model=${model} key#${ki + 1} attempt=${attempt + 1}, retrying in ${BACKOFF_MS}ms…`);
            await new Promise(r => setTimeout(r, BACKOFF_MS * (attempt + 1)));
          } else {
            break;
          }
        }
      }
      // Non-quota/overload error → surface immediately, no further tries
      if (lastError && !isQuotaError(lastError) && !isOverloadError(lastError)) throw lastError;
    }
  }

  if (isQuotaError(lastError)) {
    const n = keys.length;
    throw new Error(
      `QUOTA_EXCEEDED: All ${n} Gemini API key${n > 1 ? 's' : ''} have hit their daily quota. ` +
      `Add another key as GEMINI_API_KEY_2 in .env, or switch to OpenAI / Anthropic in the provider menu.`
    );
  }
  throw new Error('All Gemini models returned 503 — service unavailable');
}

function hasApiKey(provider: string): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  return geminiKeys().length > 0;
}

// ─── Zod runtime schemas (Section 5.1a) ──────────────────────────────────────
// These mirror the TypeScript types and enforce them at runtime on every LLM response.

const ZClarifyingQuestion = z.object({
  question: z.string().min(1),
  suggestedAnswers: z.array(z.string()).min(2).max(4),
});

const ZIntentObject = z.object({
  goal: z.string().min(1, 'goal must be a non-empty string'),
  components_mentioned: z.array(z.string()),
  missing_info: z.array(ZClarifyingQuestion),
  assumptions: z.array(z.string()),
});

const ZTradeoffs = z.object({
  cost: z.string().min(1),
  portability: z.string().min(1),
  complexity: z.string().min(1),
  power: z.string().min(1),
});

const ZArchitectureOption = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  components: z.array(z.string()).min(1),
  tradeoffs: ZTradeoffs,
  summary: z.string().min(1),
});

const ZCompareResponse = z.object({
  options: z.array(ZArchitectureOption).length(2, 'exactly 2 architecture options required'),
});

const ZMilestone = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  depends_on: z.string().nullable().optional(),
});

const ZMilestonePlan = z.object({
  milestones: z.array(ZMilestone).min(4).max(5),
});

const ZConflictResolution = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  resolvedComponents: z.array(z.string()).min(1),
  explanation: z.string().min(1),
});

const ZResolveConflictsResponse = z.object({
  resolutions: z.array(ZConflictResolution).min(1).max(3),
});

// ComponentSpec schema for on-demand block generation (/api/spec)
// AI produces component *metadata* only — the block shape and code template are
// derived deterministically from this data by registerRuntimeBlock.ts.
const ZComponentSpec = z.object({
  name: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/, 'name must use alphanumeric chars, underscores, or hyphens only'),
  category: z.enum(['Sensors', 'Actuators', 'Power', 'Control']),
  pin_types_required: z.array(z.enum(['digital', 'analog', 'pwm', 'i2c', 'interrupt'])).min(1),
  voltage: z.number().positive().max(48),
  current_ma: z.number().positive().max(5000),
  requires_driver: z.boolean(),
  notes: z.string().min(1),
  simulation: z.object({
    visual: z.enum(['led', 'servo_arm', 'buzzer_wave', 'generic_readout']),
    defaultSimulatedValue: z.union([z.number(), z.boolean()]).optional(),
  }).optional(),
});

// ─── Gemini JSON schemas (for structured output) ──────────────────────────────
const componentSpecSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    category: { type: Type.STRING },
    pin_types_required: { type: Type.ARRAY, items: { type: Type.STRING } },
    voltage: { type: Type.NUMBER },
    current_ma: { type: Type.NUMBER },
    requires_driver: { type: Type.BOOLEAN },
    notes: { type: Type.STRING },
    simulation: {
      type: Type.OBJECT,
      properties: {
        visual: { type: Type.STRING },
        defaultSimulatedValue: { type: Type.NUMBER },
      },
      required: ['visual'],
    },
  },
  required: ['name', 'category', 'pin_types_required', 'voltage', 'current_ma', 'requires_driver', 'notes'],
};

const intentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    goal: { type: Type.STRING },
    components_mentioned: { type: Type.ARRAY, items: { type: Type.STRING } },
    missing_info: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          suggestedAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['question', 'suggestedAnswers'],
      },
    },
    assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['goal', 'components_mentioned', 'missing_info', 'assumptions'],
};

const architectureOptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    options: {
      type: Type.ARRAY,
      description: 'Exactly two architecture options with genuinely different tradeoffs',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          components: { type: Type.ARRAY, items: { type: Type.STRING } },
          tradeoffs: {
            type: Type.OBJECT,
            properties: {
              cost: { type: Type.STRING },
              portability: { type: Type.STRING },
              complexity: { type: Type.STRING },
              power: { type: Type.STRING },
            },
            required: ['cost', 'portability', 'complexity', 'power'],
          },
          summary: { type: Type.STRING },
        },
        required: ['id', 'label', 'components', 'tradeoffs', 'summary'],
      },
    },
  },
  required: ['options'],
};

const milestonePlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    milestones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          depends_on: { type: Type.STRING, nullable: true },
        },
        required: ['id', 'title', 'description'],
      },
    },
  },
  required: ['milestones'],
};

const resolveConflictsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    resolutions: {
      type: Type.ARRAY,
      description: '1-3 resolution options for DRC conflicts',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          resolvedComponents: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
        },
        required: ['id', 'title', 'description', 'resolvedComponents', 'explanation'],
      },
    },
  },
  required: ['resolutions'],
};

// ─── System prompts ───────────────────────────────────────────────────────────

const CLARIFY_SYSTEM = `You are a hardware engineering assistant that helps hobbyists plan Arduino and ESP32 projects.
Your job is to turn a plain-language hardware idea into a structured intent object.

Rules:
- Identify what information is missing or ambiguous (e.g. power source, connectivity, sensor type).
- For each gap, add an entry to missing_info with a short "question" and 2–4 short "suggestedAnswers" a typical maker would pick.
- For anything you're willing to assume, state the assumption clearly in assumptions (never leave it blank).
- If the user's message is a FOLLOW-UP reply to a previous clarifying question, incorporate it into the goal and reduce missing_info accordingly.
- Keep goal concise (one sentence), components_mentioned as exact part names where possible.

Output ONLY valid JSON matching this shape:
{ "goal": string, "components_mentioned": string[], "missing_info": [{ "question": string, "suggestedAnswers": string[] }], "assumptions": string[] }

Do NOT add any commentary outside the JSON.`;

const COMPARE_SYSTEM = `You are a hardware engineering assistant.
Given a user's confirmed intent, propose EXACTLY 2 ArchitectureOptions for their project.

Rules:
- The two options must be GENUINELY DIFFERENT — different microcontrollers, different sensor types, different power strategies, etc. Not two trivial variants of the same build.
- Each option must have a realistic components list (named parts, not categories).
- Each tradeoff field (cost, portability, complexity, power) must contain a concrete, comparative sentence — not a single word.
- id must be a short kebab-case string.

Output ONLY valid JSON:
{ "options": [ <ArchitectureOption>, <ArchitectureOption> ] }

Do NOT add commentary outside the JSON.`;

const RESOLVE_CONFLICTS_SYSTEM = `You are a hardware engineering assistant expert in solving DRC (design rule check) conflicts.
Given a list of DRC conflicts and the current architecture, propose 1–3 concrete resolutions.

Rules:
- Each resolution MUST meaningfully reduce or eliminate conflicts. Show the full updated component list.
- Propose options like: "Swap HC-SR04 for 3.3V variant", "Add a 3.3V/5V level shifter", or "Use a different sensor entirely".
- Each resolution must be practical for a hobbyist to implement.
- Title should be short and actionable.
- Explanation should explicitly mention which conflict(s) it solves and why it works.
- resolvedComponents must be the COMPLETE updated component list (including any added adapters/shifters).

Output ONLY valid JSON:
{ "resolutions": [ { "id": string, "title": string, "description": string, "resolvedComponents": string[], "explanation": string } ] }

Do NOT add commentary outside the JSON.`;

// ─── Retry/error wrapper (Section 5.1a) ──────────────────────────────────────
type ConversationTurn = { role: 'user' | 'assistant'; content: string };

/**
 * Validates raw LLM JSON output against a Zod schema.
 * On failure: retries once with an error-correction prompt.
 * On second failure: returns { __schema_error: true, message: string }.
 * Never silently passes through malformed data.
 */
async function withSchemaValidation<T>(
  schema: z.ZodSchema<T>,
  rawCall: () => Promise<string>,
  retryCall: (errorMsg: string) => Promise<string>,
  label: string,
): Promise<T | { __schema_error: true; message: string }> {
  // Attempt 1
  let rawText: string;
  try {
    rawText = await rawCall();
  } catch (e: any) {
    const msg: string = e.message ?? '';
    // Quota errors won't recover from retry — surface them clearly, don't retry
    if (msg.startsWith('QUOTA_EXCEEDED:') || isQuotaError(e)) {
      return { __schema_error: true, message: msg.replace('QUOTA_EXCEEDED: ', '') };
    }
    return { __schema_error: true, message: `${label} API call failed: ${e.message}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = {};
  }

  const result = schema.safeParse(parsed);
  if (result.success) return result.data;

  const zodIssues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  console.warn(`[${label}] schema validation failed on attempt 1: ${zodIssues}. Retrying…`);

  // Attempt 2 — error-correction prompt
  let retryText: string;
  try {
    retryText = await retryCall(zodIssues);
  } catch (e: any) {
    return { __schema_error: true, message: `${label} retry API call failed: ${e.message}` };
  }

  let retryParsed: unknown;
  try {
    retryParsed = JSON.parse(retryText);
  } catch {
    retryParsed = {};
  }

  const retryResult = schema.safeParse(retryParsed);
  if (retryResult.success) return retryResult.data;

  const retryIssues = retryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  console.error(`[${label}] schema validation failed on attempt 2: ${retryIssues}. Returning error state.`);

  return {
    __schema_error: true,
    message: `The AI returned a response that didn't match the expected format (twice). Please try again. Technical detail: ${retryIssues}`,
  };
}

// ─── Raw LLM call helpers ─────────────────────────────────────────────────────

async function rawClarifyCall(provider: string, prompt: string): Promise<string> {
  if (provider === 'openai') {
    const client = openaiClient();
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLARIFY_SYSTEM },
        { role: 'user', content: prompt },
      ],
    });
    return resp.choices[0].message.content ?? '{}';
  }

  if (provider === 'anthropic') {
    const client = anthropicClient();
    const resp = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: CLARIFY_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : '{}';
  }

  // Default: Gemini
  return await geminiWithFallback({
    contents: `${CLARIFY_SYSTEM}\n\n${prompt}`,
    config: { responseMimeType: 'application/json', responseSchema: intentSchema },
  });
}

async function rawCompareCall(provider: string, prompt: string): Promise<string> {
  if (provider === 'openai') {
    const client = openaiClient();
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: COMPARE_SYSTEM },
        { role: 'user', content: prompt },
      ],
    });
    return resp.choices[0].message.content ?? '{"options":[]}';
  }

  if (provider === 'anthropic') {
    const client = anthropicClient();
    const resp = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: COMPARE_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{"options":[]}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : '{"options":[]}';
  }

  return await geminiWithFallback({
    contents: `${COMPARE_SYSTEM}\n\n${prompt}`,
    config: { responseMimeType: 'application/json', responseSchema: architectureOptionSchema },
  });
}

async function rawPlanCall(provider: string, prompt: string): Promise<string> {
  const PLAN_SYSTEM = `Given a hardware architecture option, generate a milestone plan for building it (exactly 4 or 5 milestones).
Milestones should progress from: hardware assembly → component test → logic integration → calibration/tuning → final test.
Milestone 1 must be the hardware breadboard setup only — no code integration yet.
Output ONLY valid JSON: { "milestones": [ { "id": string, "title": string, "description": string, "depends_on": string | null } ] }`;

  if (provider === 'openai') {
    const client = openaiClient();
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PLAN_SYSTEM },
        { role: 'user', content: prompt },
      ],
    });
    return resp.choices[0].message.content ?? '{"milestones":[]}';
  }

  if (provider === 'anthropic') {
    const client = anthropicClient();
    const resp = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: PLAN_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{"milestones":[]}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : '{"milestones":[]}';
  }

  return await geminiWithFallback({
    contents: `${PLAN_SYSTEM}\n\nOption: ${prompt}`,
    config: { responseMimeType: 'application/json', responseSchema: milestonePlanSchema },
  });
}

// Mocks removed to comply with Rubric Section 4 (Hard Rules)

// ─── Component spec generation (for /api/spec) ────────────────────────────────
// AI generates component *metadata* only. The Blockly block shape and Arduino
// code template are derived deterministically from this data — never from the LLM.

const SPEC_SYSTEM = `You are a hardware component database assistant for Arduino/ESP32 projects.
Given a component name (and optional description), return a JSON ComponentSpec object.
This data is used ONLY to generate block metadata and Arduino pin templates — you are NOT generating any code.

Rules:
- name: exact component model/type (alphanumeric + underscores/hyphens, no spaces). Use conventional names (MQ_2, NeoPixel, RC522_RFID, etc.)
- category: "Sensors" for sensing/measuring, "Actuators" for physical output, "Control" for logic/compute/drivers, "Power" for power management
- pin_types_required: which pin types are needed — ["digital"], ["analog"], ["pwm"], ["i2c"], or combinations
- voltage: 3.3 or 5.0 (typical Arduino/ESP32 compatible components)
- current_ma: typical draw in mA (be conservative — look up datasheet values)
- requires_driver: true if a separate driver IC or module is required
- notes: 1–2 sentence wiring note (resistors, pull-ups, libraries to install)
- simulation.visual: "led" for light output, "servo_arm" for motors/rotation, "buzzer_wave" for audio, "generic_readout" for sensors/displays

Output ONLY valid JSON. No commentary.`;

async function rawSpecCall(provider: string, componentName: string, description: string): Promise<string> {
  const userPrompt = description
    ? `Component: "${componentName}"\nDescription: "${description}"`
    : `Component: "${componentName}"`;

  if (provider === 'openai') {
    const client = openaiClient();
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SPEC_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });
    return resp.choices[0].message.content ?? '{}';
  }

  if (provider === 'anthropic') {
    const client = anthropicClient();
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SPEC_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : '{}';
  }

  // Default: Gemini
  return await geminiWithFallback({
    contents: `${SPEC_SYSTEM}\n\n${userPrompt}`,
    config: { responseMimeType: 'application/json', responseSchema: componentSpecSchema },
  });
}

// ─── High-level call functions (with schema validation + retry) ───────────────

async function callClarify(
  provider: string,
  userText: string,
  context: ConversationTurn[],
): Promise<object> {
  if (!hasApiKey(provider)) {
    throw new Error(`API key missing for ${provider}. Please configure it in your .env file.`);
  }

  const fullHistory: ConversationTurn[] = [...context, { role: 'user', content: userText }];
  const conversationBlock = fullHistory
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    .join('\n');

  const userPrompt = context.length > 0
    ? `This is a follow-up. Here is the conversation so far:\n${conversationBlock}\n\nUpdate the intent JSON based on the user's latest reply.`
    : `User idea: "${userText}"`;

  const result = await withSchemaValidation(
    ZIntentObject,
    () => rawClarifyCall(provider, userPrompt),
    (err) => rawClarifyCall(provider,
      `${userPrompt}\n\n[CORRECTION NEEDED] Your previous response failed schema validation: ${err}. Please return valid JSON matching: { "goal": string, "components_mentioned": string[], "missing_info": [{ "question": string, "suggestedAnswers": string[] }], "assumptions": string[] }`
    ),
    'clarify',
  );

  return result;
}

async function callCompare(
  provider: string,
  intent: object,
): Promise<object[] | { __schema_error: true; message: string }> {
  if (!hasApiKey(provider)) {
    throw new Error(`API key missing for ${provider}. Please configure it in your .env file.`);
  }

  const userPrompt = `Intent: ${JSON.stringify(intent, null, 2)}`;

  const result = await withSchemaValidation(
    ZCompareResponse,
    () => rawCompareCall(provider, userPrompt),
    (err) => rawCompareCall(provider,
      `${userPrompt}\n\n[CORRECTION NEEDED] Your previous response failed schema validation: ${err}. Return EXACTLY 2 options as: { "options": [option1, option2] } with all required fields.`
    ),
    'compare',
  );

  if ('__schema_error' in result) return result;
  return result.options;
}

async function callPlan(
  provider: string,
  option: object,
): Promise<object[] | { __schema_error: true; message: string }> {
  if (!hasApiKey(provider)) {
    throw new Error(`API key missing for ${provider}. Please configure it in your .env file.`);
  }

  const optionStr = JSON.stringify(option);

  const result = await withSchemaValidation(
    ZMilestonePlan,
    () => rawPlanCall(provider, optionStr),
    (err) => rawPlanCall(provider,
      `${optionStr}\n\n[CORRECTION NEEDED] Your previous response failed schema validation: ${err}. Return 4–5 milestones as: { "milestones": [{ "id": string, "title": string, "description": string, "depends_on": string|null }] }`
    ),
    'plan',
  );

  if ('__schema_error' in result) return result;
  return result.milestones;
}

async function rawResolveConflictsCall(provider: string, prompt: string): Promise<string> {
  if (provider === 'openai') {
    const client = openaiClient();
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: RESOLVE_CONFLICTS_SYSTEM },
        { role: 'user', content: prompt },
      ],
    });
    return resp.choices[0].message.content ?? '{"resolutions":[]}';
  }

  if (provider === 'anthropic') {
    const client = anthropicClient();
    const resp = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: RESOLVE_CONFLICTS_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{"resolutions":[]}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : '{"resolutions":[]}';
  }

  return await geminiWithFallback({
    contents: `${RESOLVE_CONFLICTS_SYSTEM}\n\n${prompt}`,
    config: { responseMimeType: 'application/json', responseSchema: resolveConflictsSchema },
  });
}

async function callResolveConflicts(
  provider: string,
  option: object,
  violations: object[],
): Promise<object[] | { __schema_error: true; message: string }> {
  if (!hasApiKey(provider)) {
    throw new Error(`API key missing for ${provider}. Please configure it in your .env file.`);
  }

  const optionStr = JSON.stringify(option);
  const violationsStr = JSON.stringify(violations, null, 2);
  const userPrompt = `Current architecture:\n${optionStr}\n\nConflicts to resolve:\n${violationsStr}`;

  const result = await withSchemaValidation(
    ZResolveConflictsResponse,
    () => rawResolveConflictsCall(provider, userPrompt),
    (err) => rawResolveConflictsCall(provider,
      `${userPrompt}\n\n[CORRECTION NEEDED] Your previous response failed schema validation: ${err}. Return 1-3 resolutions as: { "resolutions": [{ "id": string, "title": string, "description": string, "resolvedComponents": string[], "explanation": string }] }`
    ),
    'resolve-conflicts',
  );

  if ('__schema_error' in result) return result;
  return result.resolutions;
}

// ─── Express app ──────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = parseInt(process.env.PORT ?? '3000', 10);

  const resolveProvider = (req: express.Request): string =>
    (req.headers['x-ai-provider'] as string | undefined) ??
    process.env.AI_PROVIDER ??
    'gemini';

  // ── POST /api/clarify ────────────────────────────────────────────────────
  app.post('/api/clarify', async (req, res) => {
    try {
      const { text, context = [] } = req.body as {
        text: string;
        context?: ConversationTurn[];
      };
      if (!text?.trim()) {
        res.status(400).json({ error: 'text is required' });
        return;
      }
      const provider = resolveProvider(req);
      console.log(`[clarify] provider=${provider} context_turns=${context.length}`);
      const result = await callClarify(provider, text, context);

      // If schema validation failed, surface it explicitly to the client
      if ('__schema_error' in (result as any)) {
        res.status(422).json(result);
        return;
      }
      res.json(result);
    } catch (e: any) {
      console.error('[clarify] error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/compare ────────────────────────────────────────────────────
  app.post('/api/compare', async (req, res) => {
    try {
      const { intent } = req.body;
      if (!intent) {
        res.status(400).json({ error: 'intent is required' });
        return;
      }
      const provider = resolveProvider(req);
      console.log(`[compare] provider=${provider}`);
      const result = await callCompare(provider, intent);

      if (!Array.isArray(result) && '__schema_error' in result) {
        res.status(422).json(result);
        return;
      }
      res.json(result);
    } catch (e: any) {
      console.error('[compare] error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/spec ───────────────────────────────────────────────────────
  // Generates a ComponentSpec for a component not in the static table.
  // Returns pure metadata — the calling client derives the block and Arduino
  // code template deterministically from it via registerRuntimeBlock.ts.
  app.post('/api/spec', async (req, res) => {
    try {
      const { componentName, description = '' } = req.body as {
        componentName: string;
        description?: string;
      };
      if (!componentName?.trim()) {
        res.status(400).json({ error: 'componentName is required' });
        return;
      }
      const provider = resolveProvider(req);
      console.log(`[spec] provider=${provider} component="${componentName}"`);

      const result = await withSchemaValidation(
        ZComponentSpec,
        () => rawSpecCall(provider, componentName.trim(), description.trim()),
        (err) => rawSpecCall(
          provider,
          componentName.trim(),
          `${description.trim()}\n\n[CORRECTION] Previous response failed schema: ${err}. ` +
          `Return valid JSON: { name, category, pin_types_required[], voltage, current_ma, requires_driver, notes, simulation? }`
        ),
        'spec',
      );

      if ('__schema_error' in (result as any)) {
        res.status(422).json(result);
        return;
      }
      res.json(result);
    } catch (e: any) {
      console.error('[spec] error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/plan ───────────────────────────────────────────────────────
  app.post('/api/plan', async (req, res) => {
    try {
      const { option } = req.body;
      const provider = resolveProvider(req);
      console.log(`[plan] provider=${provider}`);

      const result = await callPlan(provider, option);

      if (!Array.isArray(result) && '__schema_error' in result) {
        res.status(422).json(result);
        return;
      }
      res.json(result);
    } catch (e: any) {
      console.error('[plan] error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/resolve-conflicts ──────────────────────────────────────────
  // Given a architecture option and list of DRC violations, AI suggests 1–3 resolutions.
  // Each resolution is a modified component list that reduces/eliminates conflicts.
  app.post('/api/resolve-conflicts', async (req, res) => {
    try {
      const { option, violations } = req.body;
      if (!option || !Array.isArray(violations)) {
        res.status(400).json({ error: 'option and violations array are required' });
        return;
      }
      const provider = resolveProvider(req);
      console.log(`[resolve-conflicts] provider=${provider}`);

      const result = await callResolveConflicts(provider, option, violations);

      if (!Array.isArray(result) && '__schema_error' in result) {
        res.status(422).json(result);
        return;
      }
      res.json(result);
    } catch (e: any) {
      console.error('[resolve-conflicts] error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/explain-violation ─────────────────────────────────────────
  // Called when the user reassigns a component to a potentially problematic pin.
  // Returns a plain-English explanation + concrete fix suggestion.
  app.post('/api/explain-violation', async (req, res) => {
    const { component, pin, reservedReason, board, pinType } = req.body as {
      component: string;
      pin: string;
      reservedReason?: string;
      board: string;
      pinType?: string;
    };

    const prompt = `You are a hardware validation assistant for Arduino/ESP32 maker projects.
A user just assigned a component to a pin that may cause problems. Explain the issue in 1-2 short, friendly sentences aimed at a maker/hobbyist. Then give one concrete alternative.

Component: ${component}
Assigned pin: ${pin} on ${board}${reservedReason ? `\nPin restriction: ${reservedReason}` : ''}${pinType ? `\nExpected pin type: ${pinType}` : ''}

Output ONLY valid JSON: { "explanation": string, "suggestion": string }`;

    try {
      const text = await geminiWithFallback({
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
      res.json({
        explanation: parsed.explanation ?? (reservedReason ?? 'This pin may cause problems.'),
        suggestion: parsed.suggestion ?? 'Choose a different, unreserved pin.',
      });
    } catch {
      // Graceful degradation — fall back to the spec reason without calling AI
      res.json({
        explanation: reservedReason ?? `${pin} is not suitable for ${component}.`,
        suggestion: 'Choose a different pin from the dropdown.',
      });
    }
  });

  // ── POST /api/risk-analysis ──────────────────────────────────────────────
  // Called after architecture approval. Returns 3-4 non-obvious build risks
  // that DRC doesn't catch (interference, power-rail noise, assembly pitfalls).
  app.post('/api/risk-analysis', async (req, res) => {
    const { components, boardName } = req.body as { components: string[]; boardName: string };

    const prompt = `You are a hardware engineering safety advisor for maker/hobbyist projects.
Given these components, identify 3-4 PRACTICAL, NON-OBVIOUS risks a beginner might encounter building this project.
Focus on: real hardware incompatibilities, power-rail noise, interference between components, common wiring mistakes, library conflicts, timing issues.
Do NOT restate DRC violations (reserved pins, voltage mismatch) — those are already shown.

Board: ${boardName}
Components: ${components.join(', ')}

Output ONLY valid JSON: { "risks": [{ "title": string, "severity": "low"|"medium"|"high", "description": string, "mitigation": string }] }`;

    try {
      const text = await geminiWithFallback({
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
      res.json({ risks: Array.isArray(parsed.risks) ? parsed.risks : [] });
    } catch {
      res.json({ risks: [] });
    }
  });

  // ── Vite dev middleware or static production ──────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const gKeys = geminiKeys();
    console.log(`\n✓ CircuitCraft server running at http://localhost:${PORT}`);
    console.log(`  Default AI provider : ${process.env.AI_PROVIDER ?? 'gemini'}`);
    console.log(`  Gemini primary model: ${GEMINI_PRIMARY}`);
    console.log(`  Gemini fallback model: ${GEMINI_FALLBACK}`);
    console.log(`  Gemini key #1 set  : ${!!process.env.GEMINI_API_KEY}`);
    console.log(`  Gemini key #2 set  : ${!!process.env.GEMINI_API_KEY_2}${!process.env.GEMINI_API_KEY_2 ? '  ← add GEMINI_API_KEY_2 to .env for quota resilience' : ''}`);
    console.log(`  OpenAI key set     : ${!!process.env.OPENAI_API_KEY}`);
    console.log(`  Anthropic key set  : ${!!process.env.ANTHROPIC_API_KEY}`);
    console.log(`  Schema validation  : Zod (retry-then-error on all LLM call sites)\n`);
  });
}

startServer();
