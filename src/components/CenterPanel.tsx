import { Undo, Redo, ZoomIn, ZoomOut, PlusCircle, Activity, ShieldCheck, ShieldAlert, Cpu, Lock, CheckCircle2, Boxes, Network } from 'lucide-react';
import type { CenterView } from '../types';
import { useCircuitStore } from '../store';
import { resolvePinAssignments } from '../lib/pinMapper';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { useRef, useEffect, useState, useCallback } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import arduinoGenerator from '../lib/arduinoGenerator';
import { findSpec, COMPONENTS, BOARD_PROFILES } from '../data/components';
import type { ComponentSpec } from '../data/components';
import { registerRuntimeBlock } from '../lib/registerRuntimeBlock';
import CustomBlockPanel from './CustomBlockPanel';
import { setActiveWorkspace, dropBlockFromEvent } from '../lib/workspaceRef';

interface CenterPanelProps {
  view: CenterView;
}

export default function CenterPanel({ view }: CenterPanelProps) {
  // Plan view is driven by App (appears once a milestone plan exists). When not
  // in plan view, the user toggles between the Blockly editor and the generated
  // schematic. Both are derived from the same validated pin assignments.
  const [buildView, setBuildView] = useState<'blocks' | 'schematic'>('blocks');
  const showPlan = view === 'plan';

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Floating Action Bar */}
      <div className="absolute top-panel-padding right-panel-padding z-20 flex items-center gap-2">
        {!showPlan && (
          <div className="bg-surface border border-outline-variant rounded flex p-1 shadow-sm">
            <button
              onClick={() => setBuildView('blocks')}
              title="Block editor"
              className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${buildView === 'blocks' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              <Boxes size={13} /> Blocks
            </button>
            <button
              onClick={() => setBuildView('schematic')}
              title="Generated schematic"
              className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${buildView === 'schematic' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              <Network size={13} /> Schematic
            </button>
          </div>
        )}
        <div className="bg-surface border border-outline-variant rounded flex p-1 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
          <button className="p-1 text-on-surface hover:bg-surface-container rounded" title="Undo">
            <Undo size={18} />
          </button>
          <button className="p-1 text-on-surface hover:bg-surface-container rounded" title="Redo">
            <Redo size={18} />
          </button>
          <div className="w-[1px] bg-outline-variant mx-1"></div>
          <button className="p-1 text-on-surface hover:bg-surface-container rounded" title="Zoom In">
            <ZoomIn size={18} />
          </button>
          <button className="p-1 text-on-surface hover:bg-surface-container rounded" title="Zoom Out">
            <ZoomOut size={18} />
          </button>
        </div>
      </div>

      {showPlan ? <PlanCanvas /> : buildView === 'schematic' ? <SchematicCanvas /> : <BlocksCanvas />}
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
    const colourMap: Record<string, string> = {
      'Sensors': '#b87333',
      'Actuators': '#d4af37',
      'Control': '#9da3a6',
      'Power': '#cc6633'
    };

    const blockJson: any = {
      type: `hardware_${spec.name}`,
      colour: colourMap[spec.category] || '#9da3a6',
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
      type: 'hardware_delay',
      message0: 'delay %1 ms',
      args0: [{ type: 'field_number', name: 'DELAY_MS', value: 1000, min: 0 }],
      previousStatement: null,
      nextStatement: null,
      colour: '#d4af37',
      tooltip: 'Pause execution for the given number of milliseconds',
    },
    {
      type: 'hardware_serial_print',
      message0: 'Serial.println( %1 )',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#9da3a6',
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
    blockStyles: {},
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
    {
      kind: "category",
      name: "Sensors",
      custom: "SENSORS_DYNAMIC",
      colour: "#b87333"
    },
    {
      kind: "category",
      name: "Actuators",
      custom: "ACTUATORS_DYNAMIC",
      colour: "#d4af37"
    },
    {
      kind: "category",
      name: "Control",
      custom: "CONTROL_DYNAMIC",
      colour: "#9da3a6"
    },
    {
      kind: "category",
      name: "Power",
      custom: "POWER_DYNAMIC",
      colour: "#cc6633"
    }
  ]
};

const initializeWorkspaceBlocks = (workspace: any, option: any) => {
  workspace.clear();
  if (!option) return;

  const boardComponent = option.components.find((c: string) => {
    const s = findSpec(c);
    return s && s.is_microcontroller;
  });
  const hostBoardName = boardComponent ? findSpec(boardComponent)?.name : 'ESP32';
  
  const boardBlock = workspace.newBlock(`hardware_${hostBoardName}`);
  boardBlock.initSvg();
  boardBlock.render();
  boardBlock.moveBy(50, 50);

  let lastBlock = boardBlock;

  const assignments = resolvePinAssignments(option);
  const processedComponents = new Set<string>();

  for (const assignment of assignments) {
    const spec = findSpec(assignment.component);
    if (!spec || spec.is_microcontroller) continue;
    
    if (processedComponents.has(spec.name)) continue;
    processedComponents.add(spec.name);

    const blockType = `hardware_${spec.name}`;
    const block = workspace.newBlock(blockType);
    
    if (spec.name === 'HC-SR04') {
      const hcsr04 = assignments.filter(a => a.component === 'HC-SR04');
      const trigPin = hcsr04[0]?.pin || 'None';
      const echoPin = hcsr04[1]?.pin || trigPin || 'None';
      block.setFieldValue(trigPin, 'TRIG_PIN');
      block.setFieldValue(echoPin, 'ECHO_PIN');
    } else if (spec.name === 'LCD_I2C') {
      const isUno = hostBoardName === 'Arduino_Uno';
      block.setFieldValue(isUno ? 'A4' : 'GPIO21', 'SDA_PIN');
      block.setFieldValue(isUno ? 'A5' : 'GPIO22', 'SCL_PIN');
      block.setFieldValue('Temp & Humid', 'LINE_1');
      block.setFieldValue('Monitoring...', 'LINE_2');
    } else {
      if (assignment.pin !== 'UNASSIGNED') {
        block.setFieldValue(assignment.pin, 'PIN');
      }
    }

    block.initSvg();
    block.render();

    const parentConnection = lastBlock.nextConnection;
    const childConnection = block.previousConnection;
    if (parentConnection && childConnection) {
      parentConnection.connect(childConnection);
    }
    
    lastBlock = block;
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

  // State for the on-demand block generator panel
  const [genPanel, setGenPanel] = useState<{ open: boolean; category: string }>({
    open: false, category: 'Sensors',
  });

  useEffect(() => {
    if (!selectedOption || !blocklyRef.current) return;

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
      const { customComponents: runtimeComps } = useCircuitStore.getState();
      const list: any[] = [];
      const assignments = resolvePinAssignments(selectedOption);
      const processed = new Set<string>();
      const activeSensors = assignments.filter(a => {
        const spec = findSpec(a.component);
        return spec && spec.category === 'Sensors';
      });

      for (const a of activeSensors) {
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

      // Runtime-generated sensor blocks
      for (const spec of runtimeComps.filter(c => c.category === 'Sensors')) {
        if (!processed.has(spec.name)) {
          list.push({ kind: 'block', type: `hardware_${spec.name}` });
        }
      }

      list.push({ kind: 'button', text: '+ Generate Block…', callbackKey: 'GEN_BLOCK_Sensors' });
      return list;
    });

    workspace.registerToolboxCategoryCallback('ACTUATORS_DYNAMIC', () => {
      const { customComponents: runtimeComps } = useCircuitStore.getState();
      const list: any[] = [];
      const assignments = resolvePinAssignments(selectedOption);
      const processed = new Set<string>();
      const activeActuators = assignments.filter(a => {
        const spec = findSpec(a.component);
        return spec && spec.category === 'Actuators';
      });

      for (const a of activeActuators) {
        const spec = findSpec(a.component)!;
        if (processed.has(spec.name)) continue;
        processed.add(spec.name);

        const defaultFields: any = {};
        if (spec.name === 'LCD_I2C' || spec.name === 'OLED_I2C') {
          const boardComp = selectedOption.components.find((c: string) => {
            const s = findSpec(c);
            return s && s.is_microcontroller;
          });
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

      for (const spec of runtimeComps.filter(c => c.category === 'Actuators')) {
        if (!processed.has(spec.name)) {
          list.push({ kind: 'block', type: `hardware_${spec.name}` });
        }
      }

      list.push({ kind: 'button', text: '+ Generate Block…', callbackKey: 'GEN_BLOCK_Actuators' });
      return list;
    });

    workspace.registerToolboxCategoryCallback('CONTROL_DYNAMIC', () => {
      const { customComponents: runtimeComps } = useCircuitStore.getState();
      const list: any[] = [];
      const boardComponent = selectedOption.components.find((c: string) => {
        const s = findSpec(c);
        return s && s.is_microcontroller;
      });
      const hostBoardName = boardComponent ? findSpec(boardComponent)?.name : 'ESP32';
      list.push({ kind: 'block', type: `hardware_${hostBoardName}` });

      const otherControls = selectedOption.components.filter((c: string) => {
        const s = findSpec(c);
        return s && s.category === 'Control' && !s.is_microcontroller;
      });
      for (const c of otherControls) {
        const spec = findSpec(c);
        if (spec) list.push({ kind: 'block', type: `hardware_${spec.name}` });
      }

      for (const spec of runtimeComps.filter(c => c.category === 'Control')) {
        list.push({ kind: 'block', type: `hardware_${spec.name}` });
      }

      list.push({ kind: 'button', text: '+ Generate Block…', callbackKey: 'GEN_BLOCK_Control' });
      return list;
    });

    workspace.registerToolboxCategoryCallback('POWER_DYNAMIC', () => {
      const { customComponents: runtimeComps } = useCircuitStore.getState();
      const list: any[] = runtimeComps
        .filter(c => c.category === 'Power')
        .map(spec => ({ kind: 'block', type: `hardware_${spec.name}` }));
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

    initializeWorkspaceBlocks(workspace, selectedOption);

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

  if (!selectedOption) {
    return (
      <div className="flex-1 dot-matrix w-full h-full relative flex flex-col items-center justify-center gap-3 text-center p-8">
        <div className="flex flex-col gap-2 items-center text-on-surface-variant">
          <div className="w-10 h-10 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center">
            <PlusCircle size={20} className="opacity-40" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">
            Select an architecture option in the Copilot to populate blocks
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 dot-matrix w-full h-full relative overflow-hidden">
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

      {approved && confidence === 'verify_manually' && validation?.violations && (
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

      {!approved && validation && <PendingReviewOverlay />}

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

function SchematicCanvas() {
  const { options, selectedOptionId, validation, swapSimulation } = useCircuitStore();
  const selectedOption = swapSimulation.active && swapSimulation.simulatedOption
    ? swapSimulation.simulatedOption
    : options.find(o => o.id === selectedOptionId);
  const confidence = validation?.confidence ?? 'verify_manually';

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

  const assignments = resolvePinAssignments(selectedOption);
  const boardComp = selectedOption.components.find((c: string) => {
    const s = findSpec(c);
    return s && s.is_microcontroller;
  });
  const boardName = (boardComp ? findSpec(boardComp)?.name : 'ESP32') ?? 'ESP32';
  const boardVoltage = findSpec(boardName)?.voltage ?? 3.3;

  // ── Layout geometry (pixel coordinates; canvas scrolls if it overflows) ──
  const rowH = 70;
  const boardX = 70;
  const boardW = 150;
  const boardTop = 50;
  const boardH = Math.max(180, assignments.length * rowH + 30);
  const railX = boardX + boardW;   // right edge of the board where pins exit
  const compX = 470;
  const compW = 170;
  const compH = 46;
  const svgW = compX + compW + 50;
  const svgH = boardTop + boardH + 50;

  return (
    <div className="flex-1 schematic-bg w-full h-full relative overflow-auto">
      {/* header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-surface/90 backdrop-blur border-b border-outline-variant/40">
        <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          Generated Schematic · {boardName} · {assignments.length} component{assignments.length === 1 ? '' : 's'}
        </span>
        <ConfidenceBadge confidence={confidence} />
      </div>

      <div style={{ paddingTop: 44 }}>
        <svg width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
          {/* ── Host board ── */}
          <rect className="schematic-component" x={boardX} y={boardTop} width={boardW} height={boardH} rx={6} stroke="#d4af37" />
          <text className="schematic-text" x={boardX + boardW / 2} y={boardTop + 24} textAnchor="middle" fill="#d4af37" style={{ fontWeight: 700, fontSize: 13 }}>{boardName}</text>
          <text className="schematic-text" x={boardX + boardW / 2} y={boardTop + 40} textAnchor="middle">U1 · {boardVoltage}V logic</text>
          <text className="schematic-text" x={boardX + 10} y={boardTop + boardH - 12} fill="#c7c6ca">GND ⏚</text>

          {/* ── Per-component wiring ── */}
          {assignments.map((a, i) => {
            const y = boardTop + 64 + i * rowH;
            const unassigned = a.pin === 'UNASSIGNED';
            const color = unassigned ? '#ffb4ab' : (SCHEMATIC_ROLE_COLOR[a.role] ?? '#4ae176');
            const compTop = y - compH / 2;

            return (
              <g key={i}>
                {/* board pin node + stub */}
                <circle cx={railX} cy={y} r={3} fill={color} />
                <line x1={railX} y1={y} x2={railX + 12} y2={y} stroke={color} strokeWidth={2} />
                <text className="schematic-text" x={railX - 8} y={y - 5} textAnchor="end" fill="#c7c6ca">{unassigned ? '—' : a.pin}</text>

                {/* wire to component */}
                <path d={`M ${railX + 12} ${y} H ${compX}`} stroke={color} strokeWidth={2} fill="none" strokeDasharray={unassigned ? '5 4' : undefined} />
                <text className="schematic-text" x={(railX + 12 + compX) / 2} y={y - 6} textAnchor="middle" fill={color} style={{ fontSize: 9 }}>{a.pinType.toUpperCase()}</text>

                {/* component box */}
                <circle cx={compX} cy={y} r={3} fill={color} />
                <rect className="schematic-component" x={compX} y={compTop} width={compW} height={compH} rx={5} stroke={color} />
                <text className="schematic-text" x={compX + 14} y={y - 2} fill="#e4e1e6" style={{ fontWeight: 600, fontSize: 12 }}>{a.component}</text>
                <text className="schematic-text" x={compX + 14} y={y + 14} fill={color} style={{ fontSize: 9 }}>{a.role.toUpperCase()} · {unassigned ? 'NO PIN AVAILABLE' : a.pin}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {assignments.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant font-mono text-[11px] uppercase tracking-wider opacity-60 pointer-events-none">
          No peripheral components to wire — add components to the architecture
        </div>
      )}
    </div>
  );
}

// ─── Plan Canvas — Module F: left-to-right ReactFlow graph ───────────────────
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
    <div className="flex-1 w-full h-full schematic-bg relative">
      {/* Plan header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-surface/90 backdrop-blur border-b border-outline-variant/40">
        <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          Milestone Plan · {plan.milestones.length} steps
        </span>
        <div className="flex items-center gap-1.5 text-secondary">
          <CheckCircle2 size={11} />
          <span className="font-mono text-[9px] uppercase tracking-wider">Architecture Approved</span>
        </div>
      </div>
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.3 }}>
        <Background color="oklch(var(--color-outline-variant))" gap={24} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
