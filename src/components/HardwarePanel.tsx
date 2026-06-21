/**
 * HardwarePanel — draggable hardware component palette for the left sidebar.
 *
 * Each card can be:
 *   • Dragged onto the Blockly canvas  → block appears at the drop position
 *   • Clicked                          → block is placed near the visible viewport
 *
 * All component data comes from the static COMPONENTS table + any AI-generated
 * customComponents in the Zustand store. Zero LLM calls happen here.
 */

import type { ComponentSpec } from '../data/components';
import { COMPONENTS } from '../data/components';
import { useCircuitStore } from '../store';
import { addBlockNearViewport } from '../lib/workspaceRef';

const CATEGORY_COLOR: Record<string, string> = {
  Sensors:   '#b87333',
  Actuators: '#d4af37',
  Control:   '#9da3a6',
  Power:     '#cc6633',
};

const PIN_BADGE: Record<string, string> = {
  digital:   'DIG',
  analog:    'ADC',
  pwm:       'PWM',
  i2c:       'I²C',
  interrupt: 'IRQ',
};

function HardwareBlockCard({ spec }: { spec: ComponentSpec }) {
  const blockType = `hardware_${spec.name}`;
  const color     = CATEGORY_COLOR[spec.category] ?? '#9da3a6';
  const pinTypes  = spec.pin_types_required.slice(0, 2);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-circuit-block', blockType);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => addBlockNearViewport(blockType)}
      title={`${spec.notes}\nDrag to canvas or click to add`}
      className="relative flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container select-none cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-lg hover:border-outline transition-all duration-150 group"
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: color }}
      />

      {/* Block body */}
      <div className="pl-3 pr-2 py-2 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-[12px] font-bold text-on-surface truncate">
            {spec.name.replace(/_/g, ' ')}
          </span>
          <span className="font-mono text-[9px] text-on-surface-variant leading-snug">
            {spec.voltage}V · {spec.current_ma}mA
          </span>
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {pinTypes.map((pt) => (
            <span
              key={pt}
              className="font-mono text-[9px] px-1.5 py-[1px] rounded border"
              style={{
                borderColor: `${color}60`,
                color,
                backgroundColor: `${color}15`,
              }}
            >
              {PIN_BADGE[pt] ?? pt.toUpperCase()}
            </span>
          ))}
          {spec.pin_types_required.length === 0 && (
            <span
              className="font-mono text-[9px] px-1.5 py-[1px] rounded border"
              style={{ borderColor: `${color}60`, color, backgroundColor: `${color}15` }}
            >
              PWR
            </span>
          )}
        </div>
      </div>

      {/* Bottom connector notch hint */}
      <div
        className="h-[2px] mx-3 mb-1 rounded-full opacity-30"
        style={{ backgroundColor: color }}
      />

      {/* Hover overlay: "drag or click" hint */}
      <div className="absolute inset-0 flex items-center justify-center bg-surface/85 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg">
        <span className="font-mono text-[9px] font-bold text-on-surface px-2 py-1 bg-surface border border-outline-variant rounded shadow-sm">
          drag or click to add
        </span>
      </div>
    </div>
  );
}

const CATEGORY_ORDER = ['Sensors', 'Actuators', 'Control', 'Power'] as const;

export default function HardwarePanel() {
  const { customComponents } = useCircuitStore();
  const allSpecs = [...COMPONENTS, ...customComponents];

  return (
    <div className="flex flex-col gap-4">
      {CATEGORY_ORDER.map((category) => {
        const specs = allSpecs.filter((s) => s.category === category);
        if (specs.length === 0) return null;
        const color = CATEGORY_COLOR[category];

        return (
          <div key={category} className="flex flex-col gap-1.5">
            {/* Category header */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                {category}
              </span>
            </div>

            {/* Block cards */}
            <div className="flex flex-col gap-1.5">
              {specs.map((spec) => (
                <HardwareBlockCard key={spec.name} spec={spec} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Usage hint */}
      <div className="mt-1 px-2 py-2 rounded border border-dashed border-outline-variant/40">
        <p className="font-mono text-[9px] text-on-surface-variant/50 text-center leading-snug">
          Drag any block onto the canvas<br />or click to place near viewport
        </p>
      </div>
    </div>
  );
}
