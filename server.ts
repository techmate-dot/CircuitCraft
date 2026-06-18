/**
 * CircuitCraft API server
 *
 * Routes /api/clarify and /api/compare to whichever AI provider is requested.
 * Provider is determined by the X-AI-Provider request header, falling back to
 * the AI_PROVIDER environment variable, then to "gemini".
 *
 * IMPORTANT: This app uses general-purpose LLM APIs (Gemini, OpenAI, Claude)
 * plus a deterministic rules engine for validation. No custom-trained ML model
 * is used anywhere in this stack.
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

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

function hasApiKey(provider: string): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  return !!process.env.GEMINI_API_KEY;
}

// ─── Gemini JSON schemas ──────────────────────────────────────────────────────
const intentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    goal: { type: Type.STRING },
    components_mentioned: { type: Type.ARRAY, items: { type: Type.STRING } },
    missing_info: { type: Type.ARRAY, items: { type: Type.STRING } },
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

// ─── Provider-agnostic LLM call ───────────────────────────────────────────────
type ConversationTurn = { role: 'user' | 'assistant'; content: string };

async function callClarify(
  provider: string,
  userText: string,
  context: ConversationTurn[],
): Promise<object> {
  if (!hasApiKey(provider)) {
    console.warn(`[mock] API key missing for ${provider}. Returning mock clarify response.`);
    if (context.length === 0) {
      return {
        goal: "Build a motion-activated alert system with buzzer or relay",
        components_mentioned: ["PIR Sensor", "Buzzer", "Relay"],
        missing_info: [
          "Do you want to use a low-power microcontroller (like ESP32) or standard Arduino Uno?",
          "Does the system need to switch high-voltage loads using a relay, or just sound a buzzer?"
        ],
        assumptions: [
          "Assuming USB or battery power is available",
          "Assuming indoor usage with a detection range of 5 meters"
        ]
      };
    } else {
      return {
        goal: "Build a motion-activated alert system using an ESP32 and a relay",
        components_mentioned: ["ESP32", "PIR Sensor", "Relay_Coil"],
        missing_info: [],
        assumptions: [
          "Assuming USB 5V power source",
          "Assuming active-high signaling for the relay control"
        ]
      };
    }
  }

  // Build the full conversation: prior context + current user message
  const fullHistory: ConversationTurn[] = [
    ...context,
    { role: 'user', content: userText },
  ];
  const conversationBlock = fullHistory
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    .join('\n');

  const userPrompt = context.length > 0
    ? `This is a follow-up. Here is the conversation so far:\n${conversationBlock}\n\nUpdate the intent JSON based on the user's latest reply.`
    : `User idea: "${userText}"`;

  if (provider === 'openai') {
    const client = openaiClient();
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLARIFY_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });
    return JSON.parse(resp.choices[0].message.content ?? '{}');
  }

  if (provider === 'anthropic') {
    const client = anthropicClient();
    const resp = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: CLARIFY_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : '{}');
  }

  // Default: Gemini
  const ai = geminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `${CLARIFY_SYSTEM}\n\n${userPrompt}`,
    config: { responseMimeType: 'application/json', responseSchema: intentSchema },
  });
  return JSON.parse(response.text ?? '{}');
}

async function callCompare(
  provider: string,
  intent: object,
): Promise<object[]> {
  if (!hasApiKey(provider)) {
    console.warn(`[mock] API key missing for ${provider}. Returning mock compare options.`);
    return [
      {
        id: "esp32-relay",
        label: "ESP32 Wi-Fi Relay Control",
        components: [
          "ESP32",
          "PIR Sensor (Pin GPIO13)",
          "Relay_Coil (Pin GPIO5)"
        ],
        tradeoffs: {
          cost: "Slightly higher due to ESP32 board cost.",
          portability: "Requires a stable 5V supply for the relay coil.",
          complexity: "Medium complexity due to wiring raw relay coil.",
          power: "High power consumption when relay coil is active (~70mA)."
        },
        summary: "Low-latency motion detection trigger with direct relay coil drive (triggers warning as Relay_Coil needs driver)."
      },
      {
        id: "arduino-buzzer",
        label: "Arduino Uno Passive Alert",
        components: [
          "Arduino_Uno",
          "PIR Sensor (Pin D2)",
          "Buzzer (Pin D3)"
        ],
        tradeoffs: {
          cost: "Very low cost using standard parts.",
          portability: "Easy to run on a 9V battery.",
          complexity: "Very low complexity, beginner friendly.",
          power: "Low power consumption, ideal for battery operation."
        },
        summary: "Simple audible alert using a piezo buzzer and motion sensor."
      }
    ];
  }

  const userPrompt = `Intent: ${JSON.stringify(intent, null, 2)}`;

  if (provider === 'openai') {
    const client = openaiClient();
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: COMPARE_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content ?? '{"options":[]}');
    return parsed.options ?? [];
  }

  if (provider === 'anthropic') {
    const client = anthropicClient();
    const resp = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: COMPARE_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{"options":[]}';
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : '{"options":[]}');
    return parsed.options ?? [];
  }

  // Default: Gemini
  const ai = geminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `${COMPARE_SYSTEM}\n\n${userPrompt}`,
    config: { responseMimeType: 'application/json', responseSchema: architectureOptionSchema },
  });
  const parsed = JSON.parse(response.text ?? '{"options":[]}');
  return parsed.options ?? [];
}

// ─── Express app ──────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Helper: resolve provider from request header → env var → 'gemini'
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
      const options = await callCompare(provider, intent);
      res.json(options);
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

      if (!hasApiKey(provider)) {
        console.warn(`[mock] API key missing for ${provider}. Returning mock milestone plan.`);
        
        // Find what components we have to customize the mock plan description dynamically
        const comps = (option?.components || []).map((c: string) => c.toLowerCase());
        const hasRelayCoil = comps.some((c: string) => c.includes("relay_coil") || c.includes("relay coil"));
        const hasRelayModule = comps.some((c: string) => c.includes("relay_module") || c.includes("relay module"));
        const hasPIR = comps.some((c: string) => c.includes("pir"));
        const hasHCSR04 = comps.some((c: string) => c.includes("hc-sr04") || c.includes("ultrasonic") || c.includes("sr04"));
        const hasBuzzer = comps.some((c: string) => c.includes("buzzer"));
        const hasServo = comps.some((c: string) => c.includes("servo") || c.includes("sg90"));
        
        const inputName = hasHCSR04 ? "HC-SR04 ultrasonic sensor" : hasPIR ? "PIR motion sensor" : "input sensor";
        const outputName = hasRelayCoil ? "Relay Coil" : hasRelayModule ? "Relay Module" : hasServo ? "Servo Motor" : hasBuzzer ? "Piezo Buzzer" : "output device";

        res.json([
          {
            id: "m1",
            title: "Hardware Setup on Breadboard",
            description: `Wire the microcontroller, ${inputName}, and ${outputName} on the breadboard following the pin mapping.`,
            depends_on: null
          },
          {
            id: "m2",
            title: "Basic Component Test",
            description: `Flash a test sketch to verify input readings from the ${inputName} and trigger the ${outputName}.`,
            depends_on: "m1"
          },
          {
            id: "m3",
            title: "Integrate System Logic",
            description: `Combine the ${inputName} reading logic with the ${outputName} response configurations.`,
            depends_on: "m2"
          },
          {
            id: "m4",
            title: "Enclosure Assembly & Test",
            description: "Mount the components into a custom box or 3D-printed enclosure and perform final stress testing.",
            depends_on: "m3"
          }
        ]);
        return;
      }

      const PLAN_SYSTEM = `Given a hardware architecture option, generate a milestone plan for building it (4-5 milestones).
Milestones should progress: clarify requirements → source parts → breadboard first component → integrate logic → test.
Output ONLY valid JSON: { "milestones": [ { id, title, description, depends_on } ] }`;

      let milestones: object[];

      if (provider === 'openai') {
        const client = openaiClient();
        const resp = await client.chat.completions.create({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: PLAN_SYSTEM },
            { role: 'user', content: `Option: ${JSON.stringify(option)}` },
          ],
        });
        const parsed = JSON.parse(resp.choices[0].message.content ?? '{"milestones":[]}');
        milestones = parsed.milestones ?? [];
      } else if (provider === 'anthropic') {
        const client = anthropicClient();
        const resp = await client.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          system: PLAN_SYSTEM,
          messages: [{ role: 'user', content: `Option: ${JSON.stringify(option)}` }],
        });
        const text = resp.content[0].type === 'text' ? resp.content[0].text : '{"milestones":[]}';
        const match = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match ? match[0] : '{"milestones":[]}');
        milestones = parsed.milestones ?? [];
      } else {
        const ai = geminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: `${PLAN_SYSTEM}\n\nOption: ${JSON.stringify(option)}`,
          config: { responseMimeType: 'application/json', responseSchema: milestonePlanSchema },
        });
        const parsed = JSON.parse(response.text ?? '{"milestones":[]}');
        milestones = parsed.milestones ?? [];
      }

      res.json(milestones);
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
    console.log(`  Gemini key set: ${!!process.env.GEMINI_API_KEY}`);
    console.log(`  OpenAI key set: ${!!process.env.OPENAI_API_KEY}`);
    console.log(`  Anthropic key set: ${!!process.env.ANTHROPIC_API_KEY}\n`);
  });
}

startServer();
