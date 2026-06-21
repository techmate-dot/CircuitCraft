/**
 * HardwarePanel — draggable hardware component palette for the left sidebar.
 *
 * Each block uses the same puzzle-piece shape as statement blocks in the Logic
 * panel (notch at top, tab at bottom) — hardware blocks always produce void
 * statements, never values.
 *
 * Placement:
 *   Drag onto canvas → block at drop position (via workspaceRef)
 *   Click            → block near top-left of visible viewport
 */

import type { ComponentSpec } from '../data/components';
import { COMPONENTS } from '../data/components';
import { useCircuitStore } from '../store';
import { addBlockNearViewport } from '../lib/workspaceRef';

// ── Category styling ──────────────────────────────────────────────────────────
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

// ── Puzzle geometry (mirrors LogicPanel) ─────────────────────────────────────
const NX = 12;
const NW = 20;
const NH = 8;
const BH = 44;   // Hardware blocks are a bit taller to fit name + sub-info
const TOTAL = NH + BH + NH;

const STATEMENT_CLIP = [
  `0% ${NH}px`,
  `${NX}px ${NH}px`,  `${NX}px 0`,  `${NX + NW}px 0`,  `${NX + NW}px ${NH}px`,
  `100% ${NH}px`,
  `100% ${NH + BH}px`,
  `${NX + NW}px ${NH + BH}px`,  `${NX + NW}px ${TOTAL}px`,  `${NX}px ${TOTAL}px`,  `${NX}px ${NH + BH}px`,
  `0% ${NH + BH}px`,
].join(', ');

// ── Hardware block card ───────────────────────────────────────────────────────
function HardwareBlockCard({ spec }: { spec: ComponentSpec }) {
  const blockType = `hardware_${spec.name}`;
  const color     = CATEGORY_COLOR[spec.category] ?? '#9da3a6';
  const pinTypes  = spec.pin_types_required.length > 0
    ? spec.pin_types_required.slice(0, 2)
    : ['power'];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-circuit-block', blockType);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => addBlockNearViewport(blockType)}
      title={`${spec.notes}\nDrag to canvas or click to add`}
      className="select-none cursor-grab active:cursor-grabbing hover:brightness-125 transition-all duration-100 group"
      style={{ filter: `drop-shadow(0 0 1px ${color}) drop-shadow(0 2px 6px rgba(0,0,0,0.7))` }}
    >
      {/* Puzzle-piece shaped dark block with colored glow outline */}
      <div
        style={{
          height: TOTAL,
          backgroundColor: '#111215',
          clipPath: `polygon(${STATEMENT_CLIP})`,
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            paddingTop: NH,
            paddingLeft: 10,
            paddingRight: 8,
            height: '100%',
          }}
        >
          {/* Component info */}
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="font-mono text-[12px] font-bold truncate leading-none" style={{ color }}>
              {spec.name.replace(/_/g, ' ')}
            </span>
            <span className="font-mono text-[9px] leading-none" style={{ color: `${color}99` }}>
              {spec.voltage}V · {spec.current_ma}mA
            </span>
          </div>

          {/* Pin type badges */}
          <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
            {pinTypes.map((pt) => (
              <span
                key={pt}
                className="font-mono text-[8px] px-1 py-px rounded leading-none"
                style={{
                  border: `1px solid ${color}55`,
                  color: `${color}cc`,
                  backgroundColor: `${color}15`,
                }}
              >
                {PIN_BADGE[pt] ?? pt.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
const CATEGORY_ORDER = ['Sensors', 'Actuators', 'Control', 'Power'] as const;

export default function HardwarePanel() {
  const { customComponents } = useCircuitStore();
  const allSpecs = [...COMPONENTS, ...customComponents];

  return (
    <div className="flex flex-col gap-4">
      {CATEGORY_ORDER.map((category) => {
        const specs = allSpecs.filter((s) => s.category === category);
        if (specs.length === 0) return null;

        return (
          <div key={category} className="flex flex-col gap-2">
            {/* Category header */}
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLOR[category] }}
              />
              <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                {category}
              </span>
            </div>

            {/* Block cards */}
            {specs.map((spec) => (
              <HardwareBlockCard key={spec.name} spec={spec} />
            ))}
          </div>
        );
      })}

      <div className="mt-1 px-2 py-2 rounded border border-dashed border-outline-variant/40">
        <p className="font-mono text-[9px] text-on-surface-variant/50 text-center leading-snug">
          Drag to canvas · click to place near viewport
        </p>
      </div>
    </div>
  );
}
