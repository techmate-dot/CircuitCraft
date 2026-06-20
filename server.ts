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
const geminiClient = () =>
  new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

const openaiClient = () =>
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });

const anthropicClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

// ─── Gemini model fallback chain ─────────────────────────────────────────────
const GEMINI_PRIMARY = 'gemini-3.5-flash';
const GEMINI_FALLBACK = 'gemini-3.1-flash-lite';

function isOverloadError(e: any): boolean {
  const status = e?.status ?? e?.statusCode ?? e?.response?.status;
  const msg: string = (e?.message ?? '').toLowerCase();
  return status === 503 || msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable');
}

async function geminiWithFallback(params: { contents: string; config: object }): Promise<string> {
  const ai = geminiClient();
  const MAX_RETRIES = 2;
  const BACKOFF_MS = 1500;

  for (const model of [GEMINI_PRIMARY, GEMINI_FALLBACK]) {
    let lastError: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await ai.models.generateContent({ model, ...params });
        if (model !== GEMINI_PRIMARY) console.warn(`[gemini] ⚠️  Using fallback model ${model} — primary returned 503`);
        return result.text ?? '{}';
      } catch (e: any) {
        lastError = e;
        if (isOverloadError(e) && attempt < MAX_RETRIES - 1) {
          console.warn(`[gemini] 503 on model=${model} attempt=${attempt + 1}, retrying in ${BACKOFF_MS}ms…`);
          await new Promise(r => setTimeout(r, BACKOFF_MS * (attempt + 1)));
        } else {
          break;
        }
      }
    }
    if (!isOverloadError(lastError)) throw lastError;
  }
  throw new Error('All Gemini models returned 503 — service unavailable');
}

function hasApiKey(provider: string): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  return !!process.env.GEMINI_API_KEY;
}

// ─── Zod runtime schemas (Section 5.1a) ──────────────────────────────────────
// These mirror the TypeScript types and enforce them at runtime on every LLM response.

const ZIntentObject = z.object({
  goal: z.string().min(1, 'goal must be a non-empty string'),
  components_mentioned: z.array(z.string()),
  missing_info: z.array(z.string()),
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

// ─── Gemini JSON schemas (for structured output) ──────────────────────────────
const intentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    goal:                  { type: Type.STRING },
    components_mentioned:  { type: Type.ARRAY, items: { type: Type.STRING } },
    missing_info:          { type: Type.ARRAY, items: { type: Type.STRING } },
    assumptions:           { type: Type.ARRAY, items: { type: Type.STRING } },
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
          id:         { type: Type.STRING },
          label:      { type: Type.STRING },
          components: { type: Type.ARRAY, items: { type: Type.STRING } },
          tradeoffs: {
            type: Type.OBJECT,
            properties: {
              cost:        { type: Type.STRING },
              portability: { type: Type.STRING },
              complexity:  { type: Type.STRING },
              power:       { type: Type.STRING },
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
          id:          { type: Type.STRING },
          title:       { type: Type.STRING },
          description: { type: Type.STRING },
          depends_on:  { type: Type.STRING, nullable: true },
        },
        required: ['id', 'title', 'description'],
      },
    },
  },
  required: ['milestones'],
};

// ─── System prompts ───────────────────────────────────────────────────────────

const CLARIFY_SYSTEM = `You are a hardware engineering assistant that helps hobbyists plan Arduino and ESP32 projects.
Your job is to turn a plain-language hardware idea into a structured intent object.

Rules:
- Identify what information is missing or ambiguous (e.g. power source, connectivity, sensor type).
- List each missing piece as a short, specific question in missing_info.
- For anything you're willing to assume, state the assumption clearly in assumptions (never leave it blank).
- If the user's message is a FOLLOW-UP reply to a previous clarifying question, incorporate it into the goal and reduce missing_info accordingly.
- Keep goal concise (one sentence), components_mentioned as exact part names where possible.

Output ONLY valid JSON matching this shape:
{ "goal": string, "components_mentioned": string[], "missing_info": string[], "assumptions": string[] }

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

// ─── Mock fallbacks (used when no API key is set) ─────────────────────────────

function mockClarifyResponse(context: ConversationTurn[]): string {
  if (context.length === 0) {
    return JSON.stringify({
      goal: 'Build a motion-activated alert system with buzzer or relay',
      components_mentioned: ['PIR Sensor', 'Buzzer', 'Relay'],
      missing_info: [
        'Do you want to use a low-power microcontroller (like ESP32) or standard Arduino Uno?',
        'Does the system need to switch high-voltage loads using a relay, or just sound a buzzer?',
      ],
      assumptions: [
        'Assuming USB or battery power is available',
        'Assuming indoor usage with a detection range of 5 metres',
      ],
    });
  }
  return JSON.stringify({
    goal: 'Build a motion-activated alert system using an ESP32 and a relay',
    components_mentioned: ['ESP32', 'PIR Sensor', 'Relay_Coil'],
    missing_info: [],
    assumptions: [
      'Assuming USB 5 V power source',
      'Assuming active-high signalling for the relay control',
    ],
  });
}

function mockCompareResponse(): string {
  return JSON.stringify({
    options: [
      {
        id: 'esp32-relay',
        label: 'ESP32 Wi-Fi Relay Control',
        components: ['ESP32', 'PIR_Sensor (Pin GPIO13)', 'Relay_Coil (Pin GPIO5)'],
        tradeoffs: {
          cost:        'Slightly higher due to ESP32 board cost (~£6 vs ~£3 for Uno).',
          portability: 'Requires a stable 5 V supply for the relay coil.',
          complexity:  'Medium complexity — raw relay coil needs a transistor driver circuit.',
          power:       'Higher power consumption when relay coil is active (~70 mA).',
        },
        summary: 'Low-latency motion detection with Wi-Fi remote monitoring capability. Note: triggers VR-008 (Relay_Coil needs driver).',
      },
      {
        id: 'arduino-buzzer',
        label: 'Arduino Uno Passive Alert',
        components: ['Arduino_Uno', 'PIR_Sensor (Pin D2)', 'Buzzer (Pin D3)'],
        tradeoffs: {
          cost:        'Very low cost — all components available for under £5.',
          portability: 'Easy to run on a 9 V battery for 10+ hours.',
          complexity:  'Very low complexity — beginner-friendly, no extra driver circuits.',
          power:       'Low power consumption, ideal for battery-powered operation.',
        },
        summary: 'Simple audible alert using a piezo buzzer and PIR motion sensor on an Arduino Uno.',
      },
    ],
  });
}

function mockPlanResponse(option: any): string {
  const comps = (option?.components || []).map((c: string) => c.toLowerCase());
  const hasRelay    = comps.some((c: string) => c.includes('relay'));
  const hasPIR      = comps.some((c: string) => c.includes('pir'));
  const hasHCSR04   = comps.some((c: string) => c.includes('hc-sr04') || c.includes('ultrasonic'));
  const hasBuzzer   = comps.some((c: string) => c.includes('buzzer'));
  const hasServo    = comps.some((c: string) => c.includes('servo'));

  const inputName  = hasHCSR04 ? 'HC-SR04 ultrasonic sensor' : hasPIR ? 'PIR motion sensor' : 'input sensor';
  const outputName = hasRelay  ? 'Relay'  : hasServo ? 'Servo Motor' : hasBuzzer ? 'Piezo Buzzer' : 'output device';

  return JSON.stringify({
    milestones: [
      {
        id: 'm1',
        title: 'Hardware Setup on Breadboard',
        description: `Wire the microcontroller, ${inputName}, and ${outputName} on the breadboard following the validated pin mapping. Power via USB only — no load switching yet.`,
        depends_on: null,
      },
      {
        id: 'm2',
        title: 'Individual Component Test',
        description: `Flash a test sketch to verify ${inputName} readings (Serial Monitor) and manually trigger the ${outputName}. Confirm no smoke or unexpected heating.`,
        depends_on: 'm1',
      },
      {
        id: 'm3',
        title: 'Integrate System Logic',
        description: `Combine ${inputName} reading with ${outputName} response. Implement threshold logic, debounce, and active/idle LED indicator.`,
        depends_on: 'm2',
      },
      {
        id: 'm4',
        title: 'Calibrate & Tune',
        description: 'Adjust sensor sensitivity and response timing. Run 50 trigger cycles and log any false positives. Fix edge cases.',
        depends_on: 'm3',
      },
      {
        id: 'm5',
        title: 'Final Enclosure & Field Test',
        description: 'Mount components in a project box. Label all connectors. Perform a 24-hour soak test before deployment.',
        depends_on: 'm4',
      },
    ],
  });
}

// ─── High-level call functions (with schema validation + retry) ───────────────

async function callClarify(
  provider: string,
  userText: string,
  context: ConversationTurn[],
): Promise<object> {
  if (!hasApiKey(provider)) {
    console.warn(`[mock] API key missing for ${provider}. Returning mock clarify response.`);
    const raw = mockClarifyResponse(context);
    return JSON.parse(raw);
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
      `${userPrompt}\n\n[CORRECTION NEEDED] Your previous response failed schema validation: ${err}. Please return valid JSON matching: { "goal": string, "components_mentioned": string[], "missing_info": string[], "assumptions": string[] }`
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
    console.warn(`[mock] API key missing for ${provider}. Returning mock compare options.`);
    const parsed = JSON.parse(mockCompareResponse());
    return parsed.options;
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
    console.warn(`[mock] API key missing for ${provider}. Returning mock milestone plan.`);
    const parsed = JSON.parse(mockPlanResponse(option));
    return parsed.milestones;
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

// ─── Express app ──────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

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
    console.log(`\n✓ CircuitCraft server running at http://localhost:${PORT}`);
    console.log(`  Default AI provider: ${process.env.AI_PROVIDER ?? 'gemini'}`);
    console.log(`  Gemini key set:    ${!!process.env.GEMINI_API_KEY}`);
    console.log(`  OpenAI key set:    ${!!process.env.OPENAI_API_KEY}`);
    console.log(`  Anthropic key set: ${!!process.env.ANTHROPIC_API_KEY}\n`);
    console.log(`  Schema validation: Zod (retry-then-error on all 3 LLM call sites)\n`);
  });
}

startServer();
