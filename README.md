<div align="center">

<img src="assets/circuitcraft_dark_ui_logo.png" alt="CircuitCraft" width="420"/>

<p><em>AI-powered hardware planning for Arduino & ESP32</em></p>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=16&pause=1000&color=D4AF37&center=true&vCenter=true&width=500&lines=Plan+your+circuit+in+plain+English;Validate+before+you+build;Generate+Arduino+code+live" alt="Typing SVG" />

<br/>

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)

</div>

---

**CircuitCraft** is an AI-powered hardware planning and development environment for Arduino and ESP32 projects. It guides you from a plain-language idea to a validated circuit plan and working Arduino code — without the risk of frying your board.

---

## Demo

[![CircuitCraft Demo](https://img.youtube.com/vi/yAUBR8wCgxU/maxresdefault.jpg)](https://www.youtube.com/watch?v=yAUBR8wCgxU)

## Screenshots

![Screen 1](assets/Screen%201.png)

![Screen 2](assets/Screen%202.png)

---

## Features

- **AI-driven planning** — Describe your project in plain English. CircuitCraft asks clarifying questions, then proposes two distinct architecture options with tradeoffs across cost, complexity, power, and portability.
- **Design Rule Check (DRC)** — Ten deterministic rules validate every architecture before you can proceed. Catches pin collisions, voltage mismatches, current budget overruns, reserved-pin violations, I2C address conflicts, and more.
- **Multi-provider AI** — Switch between Gemini, OpenAI (GPT-4o), and Anthropic (Claude) from the header. API keys stay server-side.
- **Visual block editor** — Google Blockly workspace with pre-built hardware blocks for both Arduino Uno and ESP32. Add components from the catalogue or generate custom blocks on demand.
- **Live Arduino code** — Every change in the block editor instantly compiles to a valid Arduino C++ sketch, displayed in a Monaco editor.
- **Schematic view** — React Flow renders your components and pin connections as a live circuit diagram.
- **AI conflict resolution** — If the DRC finds violations, the AI suggests concrete fixes (component swaps, level shifters, alternative pins).
- **Build risk analysis** — After approval, surfaces non-obvious risks like power-rail noise, library conflicts, and common wiring mistakes.
- **Milestone plan** — Generates a 4–5 step build plan tailored to your exact component set.

---

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite |
| State | Zustand (pipeline state machine) |
| Block editor | Google Blockly |
| Code editor | Monaco Editor |
| Schematic | React Flow |
| Backend | Express, Node.js |
| AI providers | Google Gemini, OpenAI, Anthropic Claude |
| Validation | Zod |

---

## Getting Started

### Prerequisites

- Node.js v18+

### Installation

```bash
git clone https://github.com/techmate-dot/CircuitCraft.git
cd CircuitCraft
npm install
```

### Environment

Copy `.env.example` to `.env` and add at least one API key:

```env
AI_PROVIDER="gemini"
GEMINI_API_KEY="your_gemini_api_key_here"
OPENAI_API_KEY="your_openai_api_key_here"
ANTHROPIC_API_KEY="your_anthropic_api_key_here"
```

### Run

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

---

## Deployment

The project is configured for [Render](https://render.com). Connect the repo as a **Web Service** with:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Instance type:** Free
