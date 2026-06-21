import { Undo, Redo, ZoomIn, ZoomOut, PlusCircle, Activity, ShieldCheck, ShieldAlert, Cpu, Lock, CheckCircle2, Boxes, Network, X, AlertTriangle, Pencil, CheckCheck } from 'lucide-react';
import type { CenterView } from '../types';
import { useCircuitStore } from '../store';
import { resolvePinAssignments } from '../lib/pinMapper';
import ReactFlow, { Background, Controls, useReactFlow, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { useRef, useEffect, useState, useCallback } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import arduinoGenerator from '../lib/arduinoGenerator';
import { findSpec, COMPONENTS, BOARD_PROFILES, resolveBoard } from '../data/components';
import type { ComponentSpec } from '../data/components';
import { registerRuntimeBlock } from '../lib/registerRuntimeBlock';
import CustomBlockPanel from './CustomBlockPanel';
import { setActiveWorkspace, dropBlockFromEvent } from '../lib/workspaceRef';

interface CenterPanelProps {
  view: CenterView;
}

export default function CenterPanel({ view }: CenterPanelProps) {
  const { plan } = useCircuitStore();
  // Internal tab — syncs from view prop only when it says 'blocks' (option selected).
  // Never auto-switches to 'plan'; user navigates there manually.
  const [activeTab, setActiveTab] = useState<CenterView>(view === 'plan' ? 'blocks' : view);
  const [planBadge, setPlanBadge] = useState(false);

  useEffect(() => {
    if (view === 'blocks') setActiveTab('blocks');
    // 'plan' from App.tsx is ignored — user clicks Plan tab themselves
  }, [view]);

  useEffect(() => {
    if (plan) setPlanBadge(true);
  }, [!!plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: { id: CenterView; Icon: React.ElementType; label: string }[] = [
    { id: 'blocks',    Icon: Boxes,        label: 'Blocks'    },
    { id: 'schematic', Icon: Network,      label: 'Schematic' },
    { id: 'plan',      Icon: CheckCircle2, label: 'Plan'      },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      {/* ── Persistent 3-tab bar ──────────────────────────────────────────── */}
      <div className="shrink-0 h-11 border-b border-outline-variant flex items-center justify-between px-2 bg-surface-container-low">
        <div className="flex items-center gap-1 h-full">
          {TABS.map(({ id, Icon, label }) => {
            const disabled = id === 'plan' && !plan;
            const active   = activeTab === id;
            return (
              <button
                key={id}
                disabled={disabled}
                onClick={() => {
                  setActiveTab(id);
                  if (id === 'plan') setPlanBadge(false);
                }}
                className={`relative flex items-center gap-1.5 px-3 h-full border-b-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  active
                    ? 'border-secondary text-secondary bg-surface'
                    : disabled
                      ? 'border-transparent text-on-surface-variant/25 cursor-not-allowed'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <Icon size={12} />
                {label}
                {id === 'plan' && planBadge && !active && (
                  <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-secondary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tool buttons */}
        <div className="flex items-center gap-0.5">
          <button className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded" title="Undo"><Undo size={15} /></button>
          <button className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded" title="Redo"><Redo size={15} /></button>
          <div className="w-px h-4 bg-outline-variant mx-1" />
          <button className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded" title="Zoom In"><ZoomIn size={15} /></button>
          <button className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded" title="Zoom Out"><ZoomOut size={15} /></button>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'plan'      ? <PlanCanvas />      :
         activeTab === 'schematic' ? <SchematicCanvas /> :
                                     <BlocksCanvas />}
      </div>
    </div>
  );
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: 'validated' | 'verify_manually' }) {
  if (confidence === 'validated') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/15 border border-secondary/30 text-secondary">
        <ShieldCheck size={12} />
        <span className="font-mono text-[10px] font-medium tracking-wide uppercase">Validated</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/15 border border-tertiary/30 text-tertiary animate-pulse">
      <ShieldAlert size={12} />
      <span className="font-mono text-[10px] font-medium tracking-wide uppercase">Verify Manually</span>
    </div>
  );
}

// ─── Pending-Review overlay (Module H) ────────────────────────────────────────
function PendingReviewOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-surface/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 p-6 bg-surface border border-outline-variant rounded-xl shadow-xl max-w-xs text-center">
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-tertiary/60 flex items-center justify-center">
          <Lock size={20} className="text-tertiary" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-widest text-tertiary font-bold">Pending Review</span>
          <span className="text-sm text-on-surface-variant leading-snug">
            Review the validation results in the Copilot, then click <strong>Approve Architecture</strong> to unlock the diagram and code.
          </span>
        </div>
        {/* Simulate the approve action visually — user must go to Copilot */}
        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/60 font-mono">
          <span>→ Copilot panel</span>
        </div>
      </div>
    </div>
  );
}

// ─── Block colours per role ───────────────────────────────────────────────────
const ROLE_STYLES = {
  input:         { bg: 'bg-tertiary/15 border-tertiary/40',   accent: 'bg-tertiary',   label: 'text-tertiary',   },
  output:        { bg: 'bg-secondary/15 border-secondary/40', accent: 'bg-secondary',  label: 'text-secondary',  },
  bidirectional: { bg: 'bg-error/10 border-error/30',         accent: 'bg-error',      label: 'text-error',      },
  power:         { bg: 'bg-outline-variant/20 border-outline-variant/40', accent: 'bg-on-surface-variant', label: 'text-on-surface-variant', },
};

const PIN_TYPE_ICON: Record<string, string> = {
  digital:   'DIG',
  analog:    'ADC',
  pwm:       'PWM',
  i2c:       'I²C',
  interrupt: 'IRQ',
};

function HardwareBlock({ component, pin, pinType, role }: {
  component: string;
  pin: string;
  pinType: 'digital' | 'analog' | 'pwm' | 'i2c' | 'interrupt';
  role: 'input' | 'output' | 'bidirectional' | 'power';
}) {
  const styles = ROLE_STYLES[role];
  const isUnassigned = pin === 'UNASSIGNED';

  return (
    <div className={`rounded-lg border ${styles.bg} flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none`}>
      <div className={`${styles.accent} px-3 py-1.5 flex items-center justify-between gap-2`}>
        <span className="font-mono text-[11px] font-bold text-on-secondary uppercase tracking-widest">
          {role.toUpperCase()}
        </span>
        <span className="font-mono text-[9px] text-on-secondary/80 uppercase tracking-wider">
          {PIN_TYPE_ICON[pinType] ?? pinType.toUpperCase()}
        </span>
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className={`font-mono text-[13px] font-bold ${styles.label}`}>{component}</span>
          <span className="font-mono text-[10px] text-on-surface-variant">
            {isUnassigned ? 'No pin available' : `Pin: ${pin}`}
          </span>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded border ${isUnassigned ? 'border-error/40 bg-error/10 text-error' : 'border-outline-variant bg-surface text-on-surface'}`}>
          <Cpu size={10} />
          <span className="font-mono text-[10px] font-bold">{isUnassigned ? '???' : pin}</span>
        </div>
      </div>
      <div className="px-3 pb-1.5 flex gap-2">
        <div className="h-1.5 w-6 rounded-b-sm border-x border-b border-outline-variant/50 bg-surface/40" />
      </div>
    </div>
  );
}

let blocksRegistered = false;
const registerCustomBlocks = () => {
  if (blocksRegistered) return;
  blocksRegistered = true;

  const getPinOptions = (compName: string) => {
    return () => {
      const store = useCircuitStore.getState();
      const option = store.swapSimulation.active && store.swapSimulation.simulatedOption
        ? store.swapSimulation.simulatedOption
        : store.options.find(o => o.id === store.selectedOptionId);
      const boardComponents = option?.components.filter(c => {
        const s = findSpec(c);
        return s && s.is_microcontroller;
      }) || [];
      
      const hostBoardName = boardComponents.length > 0 ? findSpec(boardComponents[0])?.name : 'ESP32';
      // v2: use BoardProfile.pins instead of deprecated ComponentSpec.available_pins
      const boardProfile = BOARD_PROFILES.find(b => b.name === hostBoardName) ?? BOARD_PROFILES.find(b => b.name === 'ESP32')!;
      
      const spec = findSpec(compName);
      if (!spec) {
        return [['None', 'None']];
      }
      
      const pins = boardProfile.pins.filter(p => !p.reserved);
      const compatiblePins = pins.filter(p =>
        p.types.some(t => spec.pin_types_required.includes(t as any))
      );
      
      if (compatiblePins.length === 0) {
        return [['None', 'None']];
      }
      return compatiblePins.map(p => [p.name, p.name]);
    };
  };

  // Generate block definitions from ComponentSpecs deterministically
  const blockDefinitions = COMPONENTS.map(spec => {
    const isController = spec.is_microcontroller;
    const styleMap: Record<string, string> = {
      'Sensors':   'sensor_blocks',
      'Actuators': 'actuator_blocks',
      'Control':   'control_blocks',
      'Power':     'power_blocks',
    };

    const blockJson: any = {
      type: `hardware_${spec.name}`,
      style: styleMap[spec.category] || 'control_blocks',
      tooltip: spec.notes || spec.name,
    };

    if (isController) {
      blockJson.message0 = `${spec.name.replace('_', ' ')} Controller`;
      blockJson.nextStatement = null;
    } else if (spec.name === 'HC-SR04') {
      blockJson.message0 = "HC-SR04 Trig %1 Echo %2";
      blockJson.args0 = [
        { type: "field_dropdown", name: "TRIG_PIN", options: getPinOptions('HC-SR04') },
        { type: "field_dropdown", name: "ECHO_PIN", options: getPinOptions('HC-SR04') }
      ];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'PIR_Sensor') {
      blockJson.message0 = "PIR Sensor Pin %1";
      blockJson.args0 = [{ type: "field_dropdown", name: "PIN", options: getPinOptions('PIR_Sensor') }];
      blockJson.message1 = "do %1";
      blockJson.args1 = [{ type: "input_statement", name: "DO" }];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'SG90_Servo') {
      blockJson.message0 = "Servo Pin %1 Angle %2";
      blockJson.args0 = [
        { type: "field_dropdown", name: "PIN", options: getPinOptions('SG90_Servo') },
        { type: "field_dropdown", name: "ANGLE", options: [["0°", "0"], ["45°", "45"], ["90°", "90"], ["135°", "135"], ["180°", "180"]] }
      ];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'Buzzer') {
      blockJson.message0 = "Buzzer Pin %1 Duration %2";
      blockJson.args0 = [
        { type: "field_dropdown", name: "PIN", options: getPinOptions('Buzzer') },
        { type: "field_dropdown", name: "DURATION", options: [["100ms", "100"], ["200ms", "200"], ["500ms", "500"], ["1000ms", "1000"]] }
      ];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'DC_Motor') {
      blockJson.message0 = "DC Motor Pin %1 Speed %2";
      blockJson.args0 = [
        { type: "field_dropdown", name: "PIN", options: getPinOptions('DC_Motor') },
        { type: "field_dropdown", name: "SPEED", options: [["OFF", "0"], ["HALF", "128"], ["FULL", "255"]] }
      ];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'Motor_Driver') {
      blockJson.message0 = "Motor Driver";
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'DHT11') {
      blockJson.message0 = "DHT11 Pin %1 Read %2";
      blockJson.args0 = [
        { type: "field_dropdown", name: "PIN", options: getPinOptions('DHT11') },
        { type: "field_dropdown", name: "TYPE", options: [["Temperature", "temp"], ["Humidity", "humid"]] }
      ];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'LCD_I2C') {
      blockJson.message0 = "LCD I2C SDA %1 SCL %2";
      blockJson.args0 = [
        { type: "field_dropdown", name: "SDA_PIN", options: getPinOptions('LCD_I2C') },
        { type: "field_dropdown", name: "SCL_PIN", options: getPinOptions('LCD_I2C') }
      ];
      blockJson.message1 = "Line 1 %1";
      blockJson.args1 = [{ type: "field_input", name: "LINE_1", text: "Hello" }];
      blockJson.message2 = "Line 2 %1";
      blockJson.args2 = [{ type: "field_input", name: "LINE_2", text: "World" }];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'OLED_I2C') {
      blockJson.message0 = "OLED I2C SDA %1 SCL %2";
      blockJson.args0 = [
        { type: "field_dropdown", name: "SDA_PIN", options: getPinOptions('OLED_I2C') },
        { type: "field_dropdown", name: "SCL_PIN", options: getPinOptions('OLED_I2C') }
      ];
      blockJson.message1 = "Line 1 %1";
      blockJson.args1 = [{ type: "field_input", name: "LINE_1", text: "System OK" }];
      blockJson.message2 = "Line 2 %1";
      blockJson.args2 = [{ type: "field_input", name: "LINE_2", text: "Active" }];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else if (spec.name === 'Photoresistor') {
      blockJson.message0 = "Photoresistor Pin %1";
      blockJson.args0 = [{ type: "field_dropdown", name: "PIN", options: getPinOptions('Photoresistor') }];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    } else {
      // Default fallback for LED, Relay_Coil, Relay_Module, etc.
      const label = spec.name.replace('_', ' ');
      blockJson.message0 = `${label} Pin %1 State %2`;
      blockJson.args0 = [
        { type: "field_dropdown", name: "PIN", options: getPinOptions(spec.name) },
        { type: "field_dropdown", name: "STATE", options: [["HIGH", "HIGH"], ["LOW", "LOW"]] }
      ];
      blockJson.previousStatement = null;
      blockJson.nextStatement = null;
    }

    return blockJson;
  });

  Blockly.common.defineBlocksWithJsonArray([
    ...blockDefinitions,
    {
      type: 'arduino_setup',
      message0: 'void setup() %1',
      args0: [{ type: 'input_statement', name: 'SETUP_BLOCKS' }],
      style: 'arduino_setup_blocks',
      tooltip: 'Code here runs once when the Arduino starts up.',
    },
    {
      type: 'arduino_loop',
      message0: 'void loop() %1',
      args0: [{ type: 'input_statement', name: 'LOOP_BLOCKS' }],
      style: 'arduino_loop_blocks',
      tooltip: 'Code here repeats forever — your main program logic.',
    },
    {
      type: 'hardware_delay',
      message0: 'delay %1 ms',
      args0: [{ type: 'field_number', name: 'DELAY_MS', value: 1000, min: 0 }],
      previousStatement: null,
      nextStatement: null,
      style: 'timing_blocks',
      tooltip: 'Pause execution for the given number of milliseconds',
    },
    {
      type: 'hardware_serial_print',
      message0: 'Serial.println( %1 )',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello' }],
      previousStatement: null,
      nextStatement: null,
      style: 'serial_blocks',
      tooltip: 'Print a line to the Serial monitor',
    },
  ]);
};



// Define the Blockly theme once. On Vite HMR this module re-runs, but the Blockly
// registry (living in node_modules) persists — so re-defining the same theme name
// throws "already registered" and leaves a half-injected workspace behind. Cache
// it, and reuse the already-registered theme if it survived a hot reload.
let obsidianGoldTheme: any = null;
function getObsidianGoldTheme() {
  if (obsidianGoldTheme) return obsidianGoldTheme;
  const reg: any = (Blockly as any).registry;
  const existing = reg?.getObject?.(reg.Type.THEME, 'obsidian_gold', false);
  if (existing) {
    obsidianGoldTheme = existing;
    return obsidianGoldTheme;
  }
  const baseTheme = (Blockly.Themes as any)?.Classic || (Blockly as any).Theme;
  obsidianGoldTheme = Blockly.Theme.defineTheme('obsidian_gold', {
    name: 'obsidian_gold',
    base: baseTheme,
    blockStyles: {
      // Hardware categories — dark body, colored outline (colourTertiary = border/shadow in Geras)
      sensor_blocks:   { colourPrimary: '#111214', colourSecondary: '#1c1a17', colourTertiary: '#b87333' },
      actuator_blocks: { colourPrimary: '#111214', colourSecondary: '#1c1b10', colourTertiary: '#d4af37' },
      control_blocks:  { colourPrimary: '#111214', colourSecondary: '#191a1b', colourTertiary: '#9da3a6' },
      power_blocks:    { colourPrimary: '#111214', colourSecondary: '#1c1612', colourTertiary: '#cc6633' },
      timing_blocks:   { colourPrimary: '#111214', colourSecondary: '#1c1b10', colourTertiary: '#d4af37' },
      serial_blocks:   { colourPrimary: '#111214', colourSecondary: '#191a1b', colourTertiary: '#9da3a6' },
      // Standard Blockly block categories — override Classic with same dark style
      logic_blocks:    { colourPrimary: '#111214', colourSecondary: '#12181c', colourTertiary: '#4cd7f6' },
      loop_blocks:     { colourPrimary: '#111214', colourSecondary: '#12181c', colourTertiary: '#4cd7f6' },
      math_blocks:     { colourPrimary: '#111214', colourSecondary: '#16121c', colourTertiary: '#c678dd' },
      text_blocks:     { colourPrimary: '#111214', colourSecondary: '#191a1b', colourTertiary: '#9da3a6' },
      variable_blocks: { colourPrimary: '#111214', colourSecondary: '#191a1b', colourTertiary: '#9da3a6' },
      variable_dynamic_blocks: { colourPrimary: '#111214', colourSecondary: '#191a1b', colourTertiary: '#9da3a6' },
      procedure_blocks: { colourPrimary: '#111214', colourSecondary: '#191a1b', colourTertiary: '#9da3a6' },
      colour_blocks:        { colourPrimary: '#111214', colourSecondary: '#191a1b', colourTertiary: '#9da3a6' },
      arduino_setup_blocks: { colourPrimary: '#0e1420', colourSecondary: '#0e1420', colourTertiary: '#4a9eff' },
      arduino_loop_blocks:  { colourPrimary: '#0e1a10', colourSecondary: '#0e1a10', colourTertiary: '#56c27a' },
    } as any,
    categoryStyles: {},
    componentStyles: {
      workspaceBackgroundColour: '#121214',
      toolboxBackgroundColour: '#1a1a1e',
      toolboxTextColour: '#e0e0e0',
      flyoutBackgroundColour: '#121214',
      flyoutTextColour: '#e0e0e0',
      scrollbarColour: '#d4af37',
      scrollbarOpacity: 0.4,
      insertionMarkerColour: '#d4af37',
      insertionMarkerOpacity: 0.3,
    } as any,
  });
  return obsidianGoldTheme;
}

const toolbox = {
  kind: "categoryToolbox",
  contents: [
    { kind: "category", name: "Sensors",   custom: "SENSORS_DYNAMIC",   colour: "#b87333" },
    { kind: "category", name: "Actuators", custom: "ACTUATORS_DYNAMIC", colour: "#d4af37" },
    { kind: "category", name: "Control",   custom: "CONTROL_DYNAMIC",   colour: "#9da3a6" },
    { kind: "category", name: "Power",     custom: "POWER_DYNAMIC",     colour: "#cc6633" },
    { kind: "sep" },
    {
      kind: "category", name: "Timing", colour: "#d4af37",
      contents: [
        { kind: "block", type: "hardware_delay" },
        { kind: "block", type: "hardware_serial_print" },
      ]
    },
    {
      kind: "category", name: "Logic", colour: "#4cd7f6",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
      ]
    },
    {
      kind: "category", name: "Loops", colour: "#4cd7f6",
      contents: [
        { kind: "block", type: "controls_repeat_ext" },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "controls_for" },
      ]
    },
    {
      kind: "category", name: "Math", colour: "#c678dd",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_modulo" },
      ]
    },
    { kind: "category", name: "Variables", custom: "VARIABLE", colour: "#9da3a6" },
  ]
};

const initializeWorkspaceBlocks = (workspace: any, option: any) => {
  workspace.clear();

  // Always place the two persistent Arduino structure containers
  const setupBlock = workspace.newBlock('arduino_setup');
  setupBlock.setDeletable(false);
  setupBlock.initSvg();
  setupBlock.render();
  setupBlock.moveBy(30, 30);

  const loopBlock = workspace.newBlock('arduino_loop');
  loopBlock.setDeletable(false);
  loopBlock.initSvg();
  loopBlock.render();
  loopBlock.moveBy(30, 220);

  if (!option) return;

  const boardComponent = option.components.find((c: string) => {
    const s = findSpec(c);
    return s && s.is_microcontroller;
  });
  const hostBoardName = boardComponent ? findSpec(boardComponent)?.name : 'ESP32';

  const assignments = resolvePinAssignments(option);
  const processedComponents = new Set<string>();
  const loopInput = loopBlock.getInput('LOOP_BLOCKS');
  let prevBlock: any = null;

  for (const assignment of assignments) {
    const spec = findSpec(assignment.component);
    if (!spec || spec.is_microcontroller) continue;
    if (processedComponents.has(spec.name)) continue;
    processedComponents.add(spec.name);

    const blockType = `hardware_${spec.name}`;
    const block = workspace.newBlock(blockType);

    if (spec.name === 'HC-SR04') {
      const hcsr04 = assignments.filter(a => a.component === 'HC-SR04');
      block.setFieldValue(hcsr04[0]?.pin || 'None', 'TRIG_PIN');
      block.setFieldValue(hcsr04[1]?.pin || hcsr04[0]?.pin || 'None', 'ECHO_PIN');
    } else if (spec.name === 'LCD_I2C') {
      const isUno = hostBoardName === 'Arduino_Uno';
      block.setFieldValue(isUno ? 'A4' : 'GPIO21', 'SDA_PIN');
      block.setFieldValue(isUno ? 'A5' : 'GPIO22', 'SCL_PIN');
      block.setFieldValue('Temp & Humid', 'LINE_1');
      block.setFieldValue('Monitoring...', 'LINE_2');
    } else if (assignment.pin !== 'UNASSIGNED') {
      try { block.setFieldValue(assignment.pin, 'PIN'); } catch { /* field may not exist for all block types */ }
    }

    block.initSvg();
    block.render();

    try {
      if (!prevBlock) {
        loopInput.connection.connect(block.previousConnection);
      } else {
        prevBlock.nextConnection.connect(block.previousConnection);
      }
    } catch {
      // If a block can't connect (e.g., no previousConnection), place it freely
      block.moveBy(350, 30 + processedComponents.size * 70);
    }
    prevBlock = block;
  }
};

function BlocksCanvas() {
  const {
    options, selectedOptionId, validation, approved,
    setGeneratedCode, setWorkspaceState,
    swapSimulation, customComponents,
  } = useCircuitStore();

  const selectedOption = swapSimulation.active && swapSimulation.simulatedOption
    ? swapSimulation.simulatedOption
    : options.find(o => o.id === selectedOptionId);

  const confidence = validation?.confidence ?? 'verify_manually';
  const blocklyRef  = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<any>(null);

  const [hintDismissed, setHintDismissed] = useState(false);

  // State for the on-demand block generator panel
  const [genPanel, setGenPanel] = useState<{ open: boolean; category: string }>({
    open: false, category: 'Sensors',
  });

  useEffect(() => {
    if (!blocklyRef.current) return;

    registerCustomBlocks();

    // HMR-safe: dispose any workspace left over from a previous effect run or a hot
    // reload, and empty the container, before injecting a fresh one. Without this,
    // Blockly DOM stacks up and the orphaned toolbox renders oversized over the page.
    if (workspaceRef.current) {
      try { workspaceRef.current.dispose(); } catch { /* already disposed */ }
      workspaceRef.current = null;
    }
    blocklyRef.current.innerHTML = '';

    const workspace = Blockly.inject(blocklyRef.current, {
      toolbox: toolbox,
      theme: getObsidianGoldTheme(),
      renderer: 'geras',
      grid: {
        spacing: 24,
        length: 3,
        colour: '#2c2c35',
        snap: true
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2
      },
      trashcan: true
    });

    workspaceRef.current = workspace;
    // Expose to the HardwarePanel / LogicPanel sidebars for block placement
    setActiveWorkspace(workspace as Blockly.WorkspaceSvg);

    workspace.registerToolboxCategoryCallback('SENSORS_DYNAMIC', () => {
      const { customComponents: runtimeComps, options: storeOpts, selectedOptionId: storeOptId, swapSimulation: storeSim } = useCircuitStore.getState();
      const currentOption = storeSim.active && storeSim.simulatedOption
        ? storeSim.simulatedOption
        : storeOpts.find(o => o.id === storeOptId);
      const list: any[] = [];
      const processed = new Set<string>();

      if (currentOption) {
        const assignments = resolvePinAssignments(currentOption);
        for (const a of assignments.filter(a => { const s = findSpec(a.component); return s && s.category === 'Sensors'; })) {
          const spec = findSpec(a.component)!;
          if (processed.has(spec.name)) continue;
          processed.add(spec.name);
          const defaultFields: any = {};
          if (spec.name === 'HC-SR04') {
            const hcsr04 = assignments.filter(x => x.component === 'HC-SR04');
            defaultFields['TRIG_PIN'] = hcsr04[0]?.pin || 'None';
            defaultFields['ECHO_PIN'] = hcsr04[1]?.pin || hcsr04[0]?.pin || 'None';
          } else if (a.pin !== 'UNASSIGNED') {
            defaultFields['PIN'] = a.pin;
          }
          list.push({ kind: 'block', type: `hardware_${spec.name}`, fields: defaultFields });
        }
      } else {
        for (const spec of COMPONENTS.filter(c => c.category === 'Sensors')) {
          list.push({ kind: 'block', type: `hardware_${spec.name}` });
        }
      }

      for (const spec of runtimeComps.filter(c => c.category === 'Sensors')) {
        if (!processed.has(spec.name)) list.push({ kind: 'block', type: `hardware_${spec.name}` });
      }
      list.push({ kind: 'button', text: '+ Generate Block…', callbackKey: 'GEN_BLOCK_Sensors' });
      return list;
    });

    workspace.registerToolboxCategoryCallback('ACTUATORS_DYNAMIC', () => {
      const { customComponents: runtimeComps, options: storeOpts, selectedOptionId: storeOptId, swapSimulation: storeSim } = useCircuitStore.getState();
      const currentOption = storeSim.active && storeSim.simulatedOption
        ? storeSim.simulatedOption
        : storeOpts.find(o => o.id === storeOptId);
      const list: any[] = [];
      const processed = new Set<string>();

      if (currentOption) {
        const assignments = resolvePinAssignments(currentOption);
        for (const a of assignments.filter(a => { const s = findSpec(a.component); return s && s.category === 'Actuators'; })) {
          const spec = findSpec(a.component)!;
          if (processed.has(spec.name)) continue;
          processed.add(spec.name);
          const defaultFields: any = {};
          if (spec.name === 'LCD_I2C' || spec.name === 'OLED_I2C') {
            const boardComp = currentOption.components.find((c: string) => { const s = findSpec(c); return s && s.is_microcontroller; });
            const isUno = boardComp && findSpec(boardComp)?.name === 'Arduino_Uno';
            defaultFields['SDA_PIN'] = isUno ? 'A4' : 'GPIO21';
            defaultFields['SCL_PIN'] = isUno ? 'A5' : 'GPIO22';
            defaultFields['LINE_1'] = spec.name === 'LCD_I2C' ? 'Temp & Humid' : 'System OK';
            defaultFields['LINE_2'] = spec.name === 'LCD_I2C' ? 'Monitoring...' : 'Active';
          } else if (a.pin !== 'UNASSIGNED') {
            defaultFields['PIN'] = a.pin;
          }
          list.push({ kind: 'block', type: `hardware_${spec.name}`, fields: defaultFields });
        }
      } else {
        for (const spec of COMPONENTS.filter(c => c.category === 'Actuators')) {
          list.push({ kind: 'block', type: `hardware_${spec.name}` });
        }
      }

      for (const spec of runtimeComps.filter(c => c.category === 'Actuators')) {
        if (!processed.has(spec.name)) list.push({ kind: 'block', type: `hardware_${spec.name}` });
      }
      list.push({ kind: 'button', text: '+ Generate Block…', callbackKey: 'GEN_BLOCK_Actuators' });
      return list;
    });

    workspace.registerToolboxCategoryCallback('CONTROL_DYNAMIC', () => {
      const { customComponents: runtimeComps, options: storeOpts, selectedOptionId: storeOptId, swapSimulation: storeSim } = useCircuitStore.getState();
      const currentOption = storeSim.active && storeSim.simulatedOption
        ? storeSim.simulatedOption
        : storeOpts.find(o => o.id === storeOptId);
      const list: any[] = [];

      if (currentOption) {
        const boardComponent = currentOption.components.find((c: string) => { const s = findSpec(c); return s && s.is_microcontroller; });
        const hostBoardName = boardComponent ? findSpec(boardComponent)?.name : 'ESP32';
        list.push({ kind: 'block', type: `hardware_${hostBoardName}` });
        for (const c of currentOption.components.filter((c: string) => { const s = findSpec(c); return s && s.category === 'Control' && !s.is_microcontroller; })) {
          const spec = findSpec(c);
          if (spec) list.push({ kind: 'block', type: `hardware_${spec.name}` });
        }
      } else {
        for (const spec of COMPONENTS.filter(c => c.category === 'Control')) {
          list.push({ kind: 'block', type: `hardware_${spec.name}` });
        }
      }

      for (const spec of runtimeComps.filter(c => c.category === 'Control')) {
        list.push({ kind: 'block', type: `hardware_${spec.name}` });
      }
      list.push({ kind: 'button', text: '+ Generate Block…', callbackKey: 'GEN_BLOCK_Control' });
      return list;
    });

    workspace.registerToolboxCategoryCallback('POWER_DYNAMIC', () => {
      const { customComponents: runtimeComps, options: storeOpts, selectedOptionId: storeOptId, swapSimulation: storeSim } = useCircuitStore.getState();
      const currentOption = storeSim.active && storeSim.simulatedOption
        ? storeSim.simulatedOption
        : storeOpts.find(o => o.id === storeOptId);
      const list: any[] = [];

      if (!currentOption) {
        for (const spec of COMPONENTS.filter(c => c.category === 'Power')) {
          list.push({ kind: 'block', type: `hardware_${spec.name}` });
        }
      }

      for (const spec of runtimeComps.filter(c => c.category === 'Power')) {
        list.push({ kind: 'block', type: `hardware_${spec.name}` });
      }
      list.push({ kind: 'button', text: '+ Generate Block…', callbackKey: 'GEN_BLOCK_Power' });
      return list;
    });

    // ── "Generate Block…" buttons at the bottom of each category flyout ──────
    // Registers one button per category. Clicking opens the CustomBlockPanel.
    (['Sensors', 'Actuators', 'Control', 'Power'] as const).forEach(cat => {
      workspace.registerButtonCallback(`GEN_BLOCK_${cat}`, () => {
        setGenPanel({ open: true, category: cat });
      });
    });

    initializeWorkspaceBlocks(workspace, selectedOption ?? null);

    // Initial code generation after scaffold — runs synchronously so
    // RightPanel's Monaco editor is populated before the user sees it.
    try {
      const code = arduinoGenerator.workspaceToCode(workspace);
      setGeneratedCode(code);
      const state = (Blockly.serialization as any).workspaces?.save(workspace);
      if (state) setWorkspaceState(state);
    } catch (err) {
      console.error('Initial code gen error:', err);
    }

    // ── Debounced change listener ──────────────────────────────────────────────
    // A single debounced traversal drives both outputs:
    //   1. Arduino C++ (for Monaco)
    //   2. Workspace snapshot (for the Section 5 simulator, zero extra traversal)
    // 300 ms prevents thrashing on continuous drag operations.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const changeListener = (event: any) => {
      if (event.isUiEvent) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          const code = arduinoGenerator.workspaceToCode(workspace);
          setGeneratedCode(code);
          // Workspace snapshot — simulator restores this in its iframe without
          // a second traversal of the live workspace.
          const state = (Blockly.serialization as any).workspaces?.save(workspace);
          if (state) setWorkspaceState(state);
        } catch (err) {
          console.error('Blockly code gen error:', err);
        }
      }, 300);
    };

    workspace.addChangeListener(changeListener);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      setActiveWorkspace(null);
      try {
        workspace.removeChangeListener(changeListener);
        workspace.dispose();
      } catch { /* already disposed */ }
      if (workspaceRef.current === workspace) workspaceRef.current = null;
      if (blocklyRef.current) blocklyRef.current.innerHTML = '';
    };
  }, [selectedOptionId, swapSimulation.active, swapSimulation.simulatedOption?.components]);

  // Called by CustomBlockPanel when a spec is ready (found in library OR AI-generated).
  // Registers the block if needed, then places one instance on the canvas.
  const handleBlockReady = useCallback((spec: ComponentSpec) => {
    // Ensure block type + Arduino generator are registered (idempotent)
    registerRuntimeBlock(spec);

    // Place a block instance on the workspace
    const ws = workspaceRef.current;
    if (!ws) return;
    try {
      const block = ws.newBlock(`hardware_${spec.name}`);
      block.initSvg();
      block.render();
      // Position below existing blocks
      block.moveBy(60, 200);
    } catch (err) {
      console.warn(`[CustomBlock] Could not place block hardware_${spec.name}:`, err);
    }
  }, []);

  return (
    <div className="flex-1 dot-matrix w-full h-full relative overflow-hidden">
      {/* Header: pipeline info when option selected, dismissible tip otherwise */}
      {selectedOption ? (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-surface/90 backdrop-blur border-b border-outline-variant/40">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              Milestone 1 — Hardware setup
            </span>
            {approved && (
              <div className="flex items-center gap-1 text-secondary">
                <CheckCircle2 size={11} />
                <span className="font-mono text-[9px] uppercase tracking-wider">Approved</span>
              </div>
            )}
          </div>
          <ConfidenceBadge confidence={confidence} />
        </div>
      ) : !hintDismissed ? (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-secondary/8 border-b border-secondary/20 backdrop-blur">
          <span className="font-mono text-[10px] text-secondary/80">
            Tip: run the Copilot wizard to auto-fill blocks — or build freely here
          </span>
          <button
            onClick={() => setHintDismissed(true)}
            className="text-secondary/50 hover:text-secondary transition-colors ml-3 shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      {selectedOption && approved && confidence === 'verify_manually' && validation?.violations && (
        <div className="absolute top-10 left-4 right-4 z-10 p-3 rounded-lg border border-tertiary/40 bg-tertiary/8 flex items-start gap-2 backdrop-blur">
          <ShieldAlert size={14} className="text-tertiary mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] font-bold text-tertiary uppercase tracking-wide">Warnings acknowledged</span>
            {validation.violations.filter(v => v.severity === 'warning').map((v, i) => (
              <span key={i} className="text-[11px] text-tertiary font-mono">· [{v.ruleId}] {v.message}</span>
            ))}
          </div>
        </div>
      )}

      <div
        ref={blocklyRef}
        className="absolute inset-0 w-full h-full"
        style={{ paddingTop: '36px' }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(e) => { e.preventDefault(); dropBlockFromEvent(e); }}
      />

      {selectedOption && !approved && validation && <PendingReviewOverlay />}

      {/* On-demand block generator — appears when "Generate Block…" toolbox button is clicked */}
      {genPanel.open && (
        <CustomBlockPanel
          category={genPanel.category}
          onClose={() => setGenPanel(p => ({ ...p, open: false }))}
          onBlockReady={handleBlockReady}
        />
      )}
    </div>
  );
}

// ─── Schematic Canvas — deterministic generator (no LLM) ─────────────────────
// Builds an SVG wiring diagram from resolvePinAssignments(option): a host-board
// box on the left, each peripheral on the right, wired to its validated pin.
// Pin numbers come exclusively from the spec table — never from raw LLM text,
// the same guarantee the code generator and pin map rely on.
const SCHEMATIC_ROLE_COLOR: Record<string, string> = {
  input:         '#4cd7f6', // tertiary
  output:        '#4ae176', // secondary
  bidirectional: '#ffb4ab', // error
  power:         '#c7c6ca', // on-surface-variant
};

// ── Component symbol renderer — pure SVG paths keyed to component name/category
// All shapes are drawn in a 32×32 viewBox centered at (0,0).
// cx/cy = center of the component box; the symbol is translated there.
type SymbolProps = { cx: number; cy: number; color: string; size?: number };

const SYMBOL_RENDERERS: Record<string, (p: SymbolProps) => React.ReactNode> = {
  // ── LED: standard schematic symbol (triangle + bar) ──────────────────────
  LED: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <polygon points="-8,8 -8,-8 8,0" fill={color} opacity={0.7} stroke={color} strokeWidth={1} />
      <line x1={8} y1={-9} x2={8} y2={9} stroke={color} strokeWidth={1.5} />
      <line x1={4} y1={-12} x2={12} y2={-6} stroke={color} strokeWidth={1} opacity={0.5} />
      <line x1={4} y1={-8} x2={12} y2={-2} stroke={color} strokeWidth={1} opacity={0.5} />
    </g>
  ),
  // ── Servo / Motor: circle with M ─────────────────────────────────────────
  Servo: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={10} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <text textAnchor="middle" dominantBaseline="central" fill={color} style={{ fontSize: 9, fontWeight: 700 }}>M</text>
      <line x1={10} y1={0} x2={14} y2={0} stroke={color} strokeWidth={1.5} />
    </g>
  ),
  // ── PIR / generic sensor: diamond ────────────────────────────────────────
  PIR: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <polygon points="0,-11 11,0 0,11 -11,0" fill="none" stroke={color} strokeWidth={1.5} opacity={0.8} />
      <circle r={3} fill={color} opacity={0.6} />
    </g>
  ),
  // ── HC-SR04 ultrasonic: two circles (transducers) ────────────────────────
  'HC-SR04': ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <circle cx={-6} cy={0} r={6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <circle cx={6} cy={0} r={6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <text x={0} y={12} textAnchor="middle" fill={color} style={{ fontSize: 7 }}>)))))</text>
    </g>
  ),
  // ── DHT11/DHT22: temperature/humidity — rounded rect with T° ─────────────
  DHT11: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <rect x={-9} y={-10} width={18} height={20} rx={4} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <text textAnchor="middle" dominantBaseline="central" fill={color} style={{ fontSize: 8, fontWeight: 600 }}>T°</text>
    </g>
  ),
  // ── Buzzer: speaker symbol ────────────────────────────────────────────────
  Buzzer: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <rect x={-4} y={-7} width={8} height={14} fill={color} opacity={0.6} />
      <polygon points="4,-7 12,-12 12,12 4,7" fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <path d="M 14 -5 Q 18 0 14 5" fill="none" stroke={color} strokeWidth={1} opacity={0.5} />
    </g>
  ),
  // ── Relay: coil + switch symbol ───────────────────────────────────────────
  Relay: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <rect x={-10} y={-6} width={12} height={12} rx={2} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <line x1={2} y1={-8} x2={10} y2={-3} stroke={color} strokeWidth={1.5} opacity={0.7} />
      <line x1={2} y1={4} x2={10} y2={4} stroke={color} strokeWidth={1.5} opacity={0.5} strokeDasharray="2 1" />
    </g>
  ),
  // ── LCD/OLED display: rectangle with grid lines ───────────────────────────
  LCD: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <rect x={-12} y={-8} width={24} height={16} rx={2} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <line x1={-8} y1={-4} x2={8} y2={-4} stroke={color} strokeWidth={0.8} opacity={0.4} />
      <line x1={-8} y1={0} x2={8} y2={0} stroke={color} strokeWidth={0.8} opacity={0.4} />
      <line x1={-8} y1={4} x2={8} y2={4} stroke={color} strokeWidth={0.8} opacity={0.4} />
    </g>
  ),
  // ── NeoPixel / WS2812: RGB LED ring ──────────────────────────────────────
  NeoPixel: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={10} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
      <circle cx={0} cy={-6} r={2} fill="#ff4444" opacity={0.7} />
      <circle cx={5} cy={4} r={2} fill="#44ff44" opacity={0.7} />
      <circle cx={-5} cy={4} r={2} fill="#4444ff" opacity={0.7} />
    </g>
  ),
  // ── Generic sensor fallback (diamond with S) ──────────────────────────────
  _sensor: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <polygon points="0,-10 10,0 0,10 -10,0" fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <text textAnchor="middle" dominantBaseline="central" fill={color} style={{ fontSize: 8, fontWeight: 600 }}>S</text>
    </g>
  ),
  // ── Generic actuator fallback (circle with A) ────────────────────────────
  _actuator: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={10} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <text textAnchor="middle" dominantBaseline="central" fill={color} style={{ fontSize: 8, fontWeight: 600 }}>A</text>
    </g>
  ),
  // ── Generic control/IC fallback ───────────────────────────────────────────
  _control: ({ cx, cy, color }) => (
    <g transform={`translate(${cx},${cy})`}>
      <rect x={-10} y={-8} width={20} height={16} rx={2} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <text textAnchor="middle" dominantBaseline="central" fill={color} style={{ fontSize: 8, fontWeight: 600 }}>IC</text>
    </g>
  ),
};

// Resolve the best symbol for a component — exact name match first, then keyword scan, then category fallback
function resolveSymbol(compName: string, category: string, props: SymbolProps): React.ReactNode {
  const name = compName.replace(/\s*\([^)]*\)/g, '').trim(); // strip "(Pin X)" suffixes
  // Exact match
  if (SYMBOL_RENDERERS[name]) return SYMBOL_RENDERERS[name](props);
  // Keyword scan
  const keywords: [string, string][] = [
    ['LED', 'LED'], ['Servo', 'Servo'], ['servo', 'Servo'], ['Motor', 'Servo'],
    ['PIR', 'PIR'], ['HC-SR04', 'HC-SR04'], ['ultrasonic', 'HC-SR04'],
    ['DHT', 'DHT11'], ['temperature', 'DHT11'], ['humidity', 'DHT11'],
    ['Buzzer', 'Buzzer'], ['buzzer', 'Buzzer'], ['speaker', 'Buzzer'],
    ['Relay', 'Relay'], ['relay', 'Relay'],
    ['LCD', 'LCD'], ['OLED', 'LCD'], ['Display', 'LCD'],
    ['NeoPixel', 'NeoPixel'], ['WS2812', 'NeoPixel'], ['RGB', 'NeoPixel'],
  ];
  for (const [kw, sym] of keywords) {
    if (name.includes(kw) && SYMBOL_RENDERERS[sym]) return SYMBOL_RENDERERS[sym](props);
  }
  // Category fallback
  const catMap: Record<string, string> = {
    Sensors: '_sensor', Actuators: '_actuator', Control: '_control', Power: '_control',
  };
  return (SYMBOL_RENDERERS[catMap[category] ?? '_sensor'])(props);
}

function SchematicCanvas() {
  const { options, selectedOptionId, validation, swapSimulation } = useCircuitStore();
  const selectedOption = swapSimulation.active && swapSimulation.simulatedOption
    ? swapSimulation.simulatedOption
    : options.find(o => o.id === selectedOptionId);
  const confidence = validation?.confidence ?? 'verify_manually';

  // ── Editable pin state ──────────────────────────────────────────────────────
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // component → overridden pin
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<{ explanation: string; suggestion: string } | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [violatedComps, setViolatedComps] = useState<Set<string>>(new Set());

  const handlePinChange = async (compName: string, newPin: string) => {
    const newOverrides = { ...overrides, [compName]: newPin };
    setOverrides(newOverrides);

    // Check if the chosen pin is reserved on the board
    const board = selectedOption ? resolveBoard(selectedOption) : null;
    const boardPin = board?.pins.find(p => p.name === newPin);

    if (boardPin?.reserved) {
      const newViolated = new Set(violatedComps);
      newViolated.add(compName);
      setViolatedComps(newViolated);

      // Fetch AI explanation for the violation
      setIsExplaining(true);
      setAiExplanation(null);
      const boardName = board?.name ?? 'ESP32';
      try {
        const resp = await fetch('/api/explain-violation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            component: compName,
            pin: newPin,
            reservedReason: boardPin.reserved_reason,
            board: boardName,
          }),
        });
        const data = resp.ok ? await resp.json() : null;
        setAiExplanation(data ?? {
          explanation: boardPin.reserved_reason ?? `${newPin} is reserved.`,
          suggestion: 'Choose a non-reserved pin from the dropdown.',
        });
      } catch {
        setAiExplanation({
          explanation: boardPin.reserved_reason ?? `${newPin} is reserved.`,
          suggestion: 'Choose a non-reserved pin from the dropdown.',
        });
      } finally {
        setIsExplaining(false);
      }
    } else {
      // Pin is valid — clear any violation for this component
      const newViolated = new Set(violatedComps);
      newViolated.delete(compName);
      setViolatedComps(newViolated);
      if (selectedComp === compName) setAiExplanation(null);
    }
  };

  if (!selectedOption) {
    return (
      <div className="flex-1 schematic-bg w-full h-full relative flex flex-col items-center justify-center gap-3 text-center p-8">
        <div className="flex flex-col gap-2 items-center text-on-surface-variant">
          <div className="w-10 h-10 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center">
            <Activity size={20} className="opacity-40" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">
            Select an architecture option in the Copilot to generate the schematic
          </span>
        </div>
      </div>
    );
  }

  const board = resolveBoard(selectedOption);
  const boardComp = selectedOption.components.find((c: string) => {
    const s = findSpec(c);
    return s && s.is_microcontroller;
  });
  const boardName = (boardComp ? findSpec(boardComp)?.name : 'ESP32') ?? 'ESP32';
  const boardVoltage = findSpec(boardName)?.voltage ?? 3.3;

  // Apply overrides to base assignments
  const baseAssignments = resolvePinAssignments(selectedOption);
  const assignments = baseAssignments.map(a =>
    overrides[a.component] ? { ...a, pin: overrides[a.component] } : a
  );

  const selectedAssignment = assignments.find(a => a.component === selectedComp);
  const selectedBase = baseAssignments.find(a => a.component === selectedComp);

  // Build dropdown options for selected component (pins of matching type + reserved ones shown disabled)
  const eligiblePins = selectedBase
    ? board.pins.filter(p => p.types.includes(selectedBase.pinType as any) || p.reserved)
    : [];

  // ── Layout geometry ────────────────────────────────────────────────────────
  const rowH = 80;
  const boardX = 80;
  const boardW = 155;
  const boardTop = 60;
  const boardH = Math.max(200, assignments.length * rowH + 40);
  const railX = boardX + boardW;       // right edge of board (pin stubs exit here)
  const midX = railX + 80;             // elbow bend x (signal wire routes here then turns right)
  const compX = midX + 60;            // left edge of component boxes
  const compW = 56;                    // component symbol square (symbol only)
  const compLabelX = compX + compW + 8;
  const compH = 56;
  // GND and VCC rails run on the right side
  const gndRailX = compX + compW + 160;
  const vccRailX = gndRailX + 30;
  const svgW = vccRailX + 50;
  const svgH = boardTop + boardH + 60;

  const headerH = selectedComp ? 96 : 44;

  return (
    <div className="flex-1 schematic-bg w-full h-full relative flex flex-col overflow-hidden">
      {/* ── Sticky header ── */}
      <div className="shrink-0 z-10 bg-surface/95 backdrop-blur border-b border-outline-variant/40">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
            Generated Schematic · {boardName} · {assignments.length} component{assignments.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            {violatedComps.size > 0 && (
              <span className="flex items-center gap-1 font-mono text-[9px] text-error uppercase tracking-wider">
                <AlertTriangle size={10} />
                {violatedComps.size} pin violation{violatedComps.size !== 1 ? 's' : ''}
              </span>
            )}
            <ConfidenceBadge confidence={confidence} />
          </div>
        </div>

        {/* ── Inline pin editor — appears when a component is selected ── */}
        {selectedComp && selectedAssignment && (
          <div className="px-4 pb-2 flex flex-col gap-1.5 border-t border-outline-variant/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil size={11} className="text-tertiary" />
                <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider">
                  Editing: {selectedComp}
                </span>
              </div>
              <button
                onClick={() => { setSelectedComp(null); setAiExplanation(null); }}
                className="text-on-surface-variant hover:text-on-surface text-xs"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant shrink-0">
                Pin
              </label>
              <select
                value={selectedAssignment.pin}
                onChange={e => handlePinChange(selectedComp, e.target.value)}
                className="flex-1 bg-surface-container border border-outline-variant rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-secondary text-on-surface"
              >
                {eligiblePins.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name}{p.reserved ? ' ⚠ reserved' : ''}{p.types.includes(selectedBase!.pinType as any) ? '' : ' (wrong type)'}
                  </option>
                ))}
              </select>
              {!violatedComps.has(selectedComp) && overrides[selectedComp] && (
                <CheckCheck size={14} className="text-secondary shrink-0" />
              )}
              {violatedComps.has(selectedComp) && (
                <AlertTriangle size={14} className="text-error shrink-0" />
              )}
            </div>

            {/* AI violation explanation */}
            {isExplaining && (
              <div className="flex items-center gap-1.5 text-tertiary text-[10px] font-mono">
                <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                AI validating pin assignment…
              </div>
            )}
            {aiExplanation && !isExplaining && (
              <div className="flex flex-col gap-1 p-2 rounded bg-error/10 border border-error/25 text-xs">
                <div className="flex items-start gap-1.5 text-error">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{aiExplanation.explanation}</span>
                </div>
                <div className="flex items-start gap-1.5 text-secondary pl-3">
                  <span className="shrink-0">→</span>
                  <span className="leading-snug">{aiExplanation.suggestion}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable SVG canvas ── */}
      <div className="flex-1 overflow-auto">
        <svg width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
          {/* ── defs: arrowhead marker ── */}
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#4cd7f6" opacity={0.5} />
            </marker>
          </defs>

          {/* ── GND rail (right side, vertical) ── */}
          <line x1={gndRailX} y1={boardTop} x2={gndRailX} y2={boardTop + boardH} stroke="#888" strokeWidth={2} opacity={0.4} />
          <text x={gndRailX} y={boardTop - 8} textAnchor="middle" fill="#888" style={{ fontSize: 9, fontFamily: 'monospace' }} opacity={0.6}>GND</text>
          <text x={gndRailX} y={boardTop + boardH + 16} textAnchor="middle" fill="#888" style={{ fontSize: 11 }} opacity={0.6}>⏚</text>

          {/* ── VCC rail (right side, vertical) ── */}
          <line x1={vccRailX} y1={boardTop} x2={vccRailX} y2={boardTop + boardH} stroke="#e05252" strokeWidth={2} opacity={0.35} />
          <text x={vccRailX} y={boardTop - 8} textAnchor="middle" fill="#e05252" style={{ fontSize: 9, fontFamily: 'monospace' }} opacity={0.6}>{boardVoltage}V</text>
          <line x1={vccRailX - 5} y1={boardTop - 18} x2={vccRailX + 5} y2={boardTop - 18} stroke="#e05252" strokeWidth={2} opacity={0.5} />
          <line x1={vccRailX - 3} y1={boardTop - 22} x2={vccRailX + 3} y2={boardTop - 22} stroke="#e05252" strokeWidth={1.5} opacity={0.4} />

          {/* ── Host board chip ── */}
          <rect className="schematic-component" x={boardX} y={boardTop} width={boardW} height={boardH} rx={8} stroke="#d4af37" strokeWidth={1.5} />
          {/* chip legs (decorative) */}
          {Array.from({ length: Math.min(assignments.length + 2, 10) }, (_, i) => (
            <line key={`leg-${i}`} x1={boardX - 8} y1={boardTop + 30 + i * 18} x2={boardX} y2={boardTop + 30 + i * 18} stroke="#d4af37" strokeWidth={1} opacity={0.3} />
          ))}
          <text className="schematic-text" x={boardX + boardW / 2} y={boardTop + 26} textAnchor="middle" fill="#d4af37" style={{ fontWeight: 700, fontSize: 13 }}>{boardName}</text>
          <text className="schematic-text" x={boardX + boardW / 2} y={boardTop + 42} textAnchor="middle" style={{ fontSize: 9 }}>U1 · {boardVoltage}V</text>
          {/* Board GND pin stub */}
          <line x1={railX} y1={boardTop + boardH - 20} x2={gndRailX} y2={boardTop + boardH - 20} stroke="#888" strokeWidth={1} opacity={0.35} strokeDasharray="3 3" />
          <circle cx={railX} cy={boardTop + boardH - 20} r={3} fill="#888" opacity={0.4} />
          <text x={railX - 6} y={boardTop + boardH - 14} textAnchor="end" fill="#888" style={{ fontSize: 8 }} opacity={0.5}>GND</text>
          {/* Board VCC pin stub */}
          <line x1={railX} y1={boardTop + 20} x2={vccRailX} y2={boardTop + 20} stroke="#e05252" strokeWidth={1} opacity={0.3} strokeDasharray="3 3" />
          <circle cx={railX} cy={boardTop + 20} r={3} fill="#e05252" opacity={0.35} />
          <text x={railX - 6} y={boardTop + 15} textAnchor="end" fill="#e05252" style={{ fontSize: 8 }} opacity={0.5}>{boardVoltage}V</text>

          {/* ── Per-component wiring ── */}
          {assignments.map((a, i) => {
            const y = boardTop + 70 + i * rowH;
            const unassigned = a.pin === 'UNASSIGNED';
            const isViolated = violatedComps.has(a.component);
            const isSelected = selectedComp === a.component;
            const baseColor = unassigned || isViolated ? '#ffb4ab' : (SCHEMATIC_ROLE_COLOR[a.role] ?? '#4ae176');
            const wireColor = isViolated ? '#ffb4ab' : baseColor;
            const compCx = compX + compW / 2;  // center x of symbol square
            const compCy = y;                    // center y

            // Get component spec for symbol lookup
            const spec = findSpec(a.component);
            const category = spec?.category ?? 'Sensors';

            return (
              <g
                key={i}
                onClick={() => {
                  setSelectedComp(isSelected ? null : a.component);
                  if (!isSelected) setAiExplanation(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* ── selection / violation ring behind everything ── */}
                {(isSelected || isViolated) && (
                  <rect
                    x={compX - 5} y={compCy - compH / 2 - 5}
                    width={compW + 10} height={compH + 10}
                    rx={10} fill={isViolated ? '#ffb4ab18' : '#d4af3712'}
                    stroke={isViolated ? '#ffb4ab' : '#d4af37'}
                    strokeWidth={1.5}
                    strokeDasharray={isViolated ? undefined : '5 3'}
                  />
                )}

                {/* ── board pin stub ── */}
                <circle cx={railX} cy={y} r={3.5} fill={wireColor} opacity={0.9} />
                <text
                  x={railX - 10} y={y + 4}
                  textAnchor="end" fill={isViolated ? '#ffb4ab' : '#a0a0b0'}
                  style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: isViolated ? 700 : 400 }}
                >
                  {unassigned ? '—' : a.pin}
                </text>

                {/* ── elbow-routed signal wire: stub → right → down/up → component ── */}
                <path
                  d={`M ${railX} ${y} H ${midX} V ${y} H ${compX}`}
                  stroke={wireColor}
                  strokeWidth={isViolated ? 2.5 : 1.8}
                  fill="none"
                  strokeDasharray={unassigned ? '6 3' : undefined}
                  opacity={isViolated ? 1 : 0.85}
                />
                {/* wire junction dot at elbow */}
                <circle cx={midX} cy={y} r={2.5} fill={wireColor} opacity={0.6} />
                {/* pin type label on wire */}
                <text
                  x={(midX + compX) / 2} y={y - 7}
                  textAnchor="middle" fill={wireColor}
                  style={{ fontSize: 8, fontFamily: 'monospace' }}
                  opacity={0.7}
                >
                  {a.pinType.toUpperCase()}
                </text>

                {/* ── component GND wire ── */}
                {!unassigned && (
                  <>
                    <line
                      x1={compX + compW} y1={y + 8}
                      x2={gndRailX} y2={y + 8}
                      stroke="#888" strokeWidth={1} opacity={0.25} strokeDasharray="3 3"
                    />
                    <circle cx={gndRailX} cy={y + 8} r={2} fill="#888" opacity={0.3} />
                  </>
                )}
                {/* ── component VCC wire ── */}
                {!unassigned && (
                  <>
                    <line
                      x1={compX + compW} y1={y - 8}
                      x2={vccRailX} y2={y - 8}
                      stroke="#e05252" strokeWidth={1} opacity={0.2} strokeDasharray="3 3"
                    />
                    <circle cx={vccRailX} cy={y - 8} r={2} fill="#e05252" opacity={0.25} />
                  </>
                )}

                {/* ── component symbol square ── */}
                <rect
                  x={compX} y={compCy - compH / 2}
                  width={compW} height={compH}
                  rx={6}
                  fill="#111215" stroke={wireColor}
                  strokeWidth={isSelected ? 2 : 1.2}
                  opacity={isViolated ? 1 : 0.95}
                />
                {/* left input stub */}
                <line x1={compX - 8} y1={y} x2={compX} y2={y} stroke={wireColor} strokeWidth={1.5} opacity={0.7} />
                <circle cx={compX} cy={y} r={2} fill={wireColor} opacity={0.8} />

                {/* ── schematic symbol (component-specific) ── */}
                {resolveSymbol(a.component, category, { cx: compCx, cy: compCy, color: wireColor })}

                {/* ── component name label (right of symbol box) ── */}
                <text
                  x={compLabelX} y={compCy - 6}
                  fill="#e4e1e6"
                  style={{ fontSize: 11, fontWeight: 600, fontFamily: 'sans-serif' }}
                >
                  {a.component.replace(/\s*\([^)]*\)/g, '')}
                </text>
                <text
                  x={compLabelX} y={compCy + 10}
                  fill={wireColor}
                  style={{ fontSize: 8.5, fontFamily: 'monospace' }}
                >
                  {isViolated ? `⚠ RESERVED · ${a.pin}` : `${a.role.toUpperCase()} · ${unassigned ? 'NO PIN' : a.pin}`}
                </text>

                {/* ── edit hint ✎ ── */}
                <text
                  x={compX + compW - 6} y={compCy - compH / 2 + 12}
                  fill="#c7c6ca" style={{ fontSize: 9 }} opacity={0.4}
                  textAnchor="end"
                >
                  ✎
                </text>
              </g>
            );
          })}
        </svg>

        {assignments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant font-mono text-[11px] uppercase tracking-wider opacity-60 pointer-events-none">
            No peripheral components to wire — add components to the architecture
          </div>
        )}
      </div>

      {/* Click hint */}
      {assignments.length > 0 && !selectedComp && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant opacity-50 pointer-events-none">
          <Pencil size={9} />
          Click a component to edit its pin
        </div>
      )}
    </div>
  );
}

// ─── Plan Canvas — Module F: left-to-right ReactFlow graph ───────────────────
function PlanCanvasHeader({ milestoneCount }: { milestoneCount: number }) {
  const { fitView } = useReactFlow();
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-surface/90 backdrop-blur border-b border-outline-variant/40">
      <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
        Milestone Plan · {milestoneCount} steps
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => fitView({ padding: 0.3, duration: 400 })}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-colors border border-outline-variant/40"
          title="Center all nodes in view"
        >
          <Network size={11} />
          Center
        </button>
        <div className="flex items-center gap-1.5 text-secondary">
          <CheckCircle2 size={11} />
          <span className="font-mono text-[9px] uppercase tracking-wider">Architecture Approved</span>
        </div>
      </div>
    </div>
  );
}

function PlanCanvas() {
  const { plan, currentMilestoneId } = useCircuitStore();

  if (!plan) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3 text-on-surface-variant schematic-bg">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center opacity-50">
            <CheckCircle2 size={16} />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">
            Approve the architecture to generate the milestone plan
          </span>
        </div>
      </div>
    );
  }

  // Horizontal left-to-right layout
  const STEP_WIDTH = 280;
  const STEP_Y = 80;

  const nodes = plan.milestones.map((m, i) => {
    const isFirst = i === 0;
    const isActive = currentMilestoneId ? currentMilestoneId === m.id : isFirst;
    return {
      id: m.id,
      position: { x: 40 + i * STEP_WIDTH, y: STEP_Y },
      data: {
        label: (
          <div className="flex flex-col gap-1 p-3 w-[220px] text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">{`M${i + 1}`}</span>
              {isActive && (
                <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-full bg-secondary text-on-secondary uppercase tracking-wider">Active</span>
              )}
            </div>
            <div className="font-bold text-sm tracking-tight">{m.title}</div>
            <div className="text-xs text-on-surface-variant leading-snug">{m.description}</div>
          </div>
        ),
      },
      style: {
        backgroundColor: isActive
          ? 'oklch(var(--color-secondary) / 0.1)'
          : 'oklch(var(--color-surface))',
        borderColor: isActive
          ? 'oklch(var(--color-secondary) / 0.6)'
          : 'oklch(var(--color-outline-variant))',
        borderWidth: isActive ? 2 : 1,
        borderRadius: 10,
        padding: 0,
        width: 240,
      },
    };
  });

  const edges = plan.milestones
    .filter(m => m.depends_on)
    .map(m => ({
      id: `e-${m.depends_on}-${m.id}`,
      source: m.depends_on!,
      target: m.id,
      animated: true,
      style: { stroke: 'oklch(var(--color-secondary))' },
    }));

  return (
    <ReactFlowProvider>
      <div className="flex-1 w-full h-full schematic-bg relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          panOnScroll={false}
          minZoom={0.2}
          maxZoom={2}
          attributionPosition="bottom-right"
        >
          <PlanCanvasHeader milestoneCount={plan.milestones.length} />
          <Background color="oklch(var(--color-outline-variant))" gap={24} />
          <Controls position="bottom-left" style={{ marginBottom: 8, marginLeft: 8 }} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
