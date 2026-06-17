import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, Schema } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
      description: "Exactly two architecture options",
    }
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
    }
  },
  required: ['milestones']
};

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  app.post('/api/clarify', async (req, res) => {
    try {
      const { text } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `System: You turn a hobbyist's plain-language hardware idea into a structured intent object. Identify what's missing or ambiguous. Output ONLY valid JSON matching this shape: { goal, components_mentioned, missing_info, assumptions }. If something is ambiguous, state your assumption rather than leaving it blank.\n\nUser: "${text}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: intentSchema,
        }
      });
      res.json(JSON.parse(response.text!));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/compare', async (req, res) => {
    try {
      const { intent } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `System: Given the user intent, propose exactly 2 ArchitectureOptions with genuinely different tradeoffs. Output valid JSON.\n\nIntent: ${JSON.stringify(intent)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: architectureOptionSchema,
        }
      });
      res.json(JSON.parse(response.text!).options);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/plan', async (req, res) => {
    try {
      const { option } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `System: Given the architecture option, generate a milestone plan for building it (4-5 milestones).\n\nOption: ${JSON.stringify(option)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: milestonePlanSchema,
        }
      });
      res.json(JSON.parse(response.text!).milestones);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
