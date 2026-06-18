# CircuitCraft

**CircuitCraft** is an intelligent, hardware-in-the-loop copilot and development environment for physical computing. It bridges the gap between high-level hardware ideas and safe, physically correct implementation details.

---

## Key Features

1. **AI Reasoning Loop (Two-Turn Clarification)**
   * Detects ambiguities in vague prompts (e.g. asking for "a motion detector alarm") and asks clarifying questions before generating alternatives.
   * Proposes two distinct options with detailed tradeoffs in cost, portability, complexity, and power draw.

2. **Deterministic Hardware Validator**
   * Automatically validates pin assignments against a strict, static component specification database (supporting digital, analog, pwm, i2c, and interrupt modes).
   * Generates confidence badges (`Validated` vs. `Verify Manually`), catches duplicate pin collisions, and calculates total current draw limits.

3. **Interactive Blockly Workspace**
   * A fully interactive Google Blockly workspace styled in a sleek Obsidian/Gold palette.
   * Dynamic flyouts populate only the components active in your selected option.
   * Dynamic pin dropdown selectors filter choices to display *only* compatible physical pins for the active microcontroller.

4. **Monaco Editor Live Synchronization**
   * Features a hand-written Arduino C++ block-code generator that compiles layouts into fully functional sketches live on every block edit.

5. **What-If Sandbox & Sourcing Layer**
   * Swap out components (e.g., swapping a raw `Relay_Coil` to an integrated `Relay_Module` to eliminate driver warning).
   * Shows price estimation in Nigerian Naira (₦) and localized sourcing/resilience tips tailored for the Lagos maker community.

---

## Tech Stack

* **Frontend**: React, Zustand, Tailwind CSS, Monaco Editor, Google Blockly, Lucide React, React Flow.
* **Backend**: Express, Node.js.
* **LLM Integration**: Google Gen AI SDK (Gemini 2.5 Pro/Flash).

---

## Getting Started

### Prerequisites
* Node.js (v18+)

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure your environment variables:
   * Create a `.env` file in the root directory and add your Gemini API Key:
     ```env
     GEMINI_API_KEY="your-gemini-api-key-here"
     ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at [http://localhost:3000](http://localhost:3000).
