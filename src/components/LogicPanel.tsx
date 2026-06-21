/**
 * LogicPanel — draggable control-flow, timing, logic, math, and serial blocks.
 *
 * All blocks here map to either standard Blockly block types (imported via
 * 'blockly/blocks' in CenterPanel) or custom types registered in
 * registerCustomBlocks() (hardware_delay, hardware_serial_print).
 *
 * Two placement modes:
 *   • Drag onto the Blockly canvas → block appears at the exact drop position
 *   • Click                        → block is placed near the visible viewport
 */

import { addBlockNearViewport } from '../lib/workspaceRef';

// ── Block catalog ─────────────────────────────────────────────────────────────

interface BlockDef {
  type: string;
  label: string;
  /** 'statement' = has top/bottom connector notches; 'value' = expression / pill shape */
  shape: 'statement' | 'value';
  desc: string;
}

interface Group {
  name: string;
  color: string;
  blocks: BlockDef[];
}

const GROUPS: Group[] = [
  {
    name: 'Control Flow',
    color: '#4cd7f6',
    blocks: [
      { type: 'controls_if',         label: 'if … do',         shape: 'statement', desc: 'Run code only when a condition is true' },
      { type: 'controls_repeat_ext', label: 'repeat N times',  shape: 'statement', desc: 'Loop N times (value from a Math block)' },
      { type: 'controls_whileUntil', label: 'while … do',      shape: 'statement', desc: 'Loop while / until a condition holds' },
      { type: 'controls_for',        label: 'count from…to',   shape: 'statement', desc: 'For-loop with start, end, and step' },
    ],
  },
  {
    name: 'Timing',
    color: '#d4af37',
    blocks: [
      { type: 'hardware_delay', label: 'delay (ms)', shape: 'statement', desc: 'Pause execution for N milliseconds' },
    ],
  },
  {
    name: 'Logic',
    color: '#4ae176',
    blocks: [
      { type: 'logic_compare',   label: 'A = B',   shape: 'value', desc: 'Compare two values: = ≠ < > ≤ ≥' },
      { type: 'logic_operation', label: 'A and B', shape: 'value', desc: 'Logical AND or OR of two booleans' },
      { type: 'logic_negate',    label: 'not A',   shape: 'value', desc: 'Negate a boolean value' },
      { type: 'logic_boolean',   label: 'true',    shape: 'value', desc: 'Boolean literal: true or false' },
    ],
  },
  {
    name: 'Math',
    color: '#c678dd',
    blocks: [
      { type: 'math_number',     label: '0',       shape: 'value', desc: 'A numeric constant' },
      { type: 'math_arithmetic', label: 'A + B',   shape: 'value', desc: 'Arithmetic: +  −  ×  ÷' },
      { type: 'math_modulo',     label: 'A mod B', shape: 'value', desc: 'Remainder of A divided by B' },
    ],
  },
  {
    name: 'Serial',
    color: '#9da3a6',
    blocks: [
      { type: 'hardware_serial_print', label: 'Serial.println', shape: 'statement', desc: 'Print a value to the Serial monitor at 115200 baud' },
    ],
  },
];

// ── Shared drag handlers ──────────────────────────────────────────────────────

function startDrag(e: React.DragEvent, blockType: string) {
  e.dataTransfer.setData('application/x-circuit-block', blockType);
  e.dataTransfer.effectAllowed = 'copy';
}

// ── Statement block card ─────────────────────────────────────────────────────
// Rectangular shape with top/bottom notch indicators — matches Blockly's
// puzzle-piece language for blocks that belong in a sequence (void statements).

function StatementCard({ block, color }: { block: BlockDef; color: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => startDrag(e, block.type)}
      onClick={() => addBlockNearViewport(block.type)}
      title={block.desc}
      className="relative select-none cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-lg transition-all duration-150 group"
    >
      {/* Top notch connector (simulates Blockly's top puzzle-notch) */}
      <div
        className="absolute top-0 left-8 w-7 h-[3px] rounded-b"
        style={{ backgroundColor: color, opacity: 0.75 }}
      />

      {/* Block body */}
      <div className="mt-[3px] mb-[3px] mx-0 rounded border border-outline-variant bg-surface-container flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[12px] font-bold text-on-surface leading-none">
          {block.label}
        </span>
        {/* Small colour swatch that hints "statement" shape */}
        <div
          className="w-4 h-[14px] rounded-sm opacity-50 shrink-0"
          style={{ backgroundColor: color }}
        />
      </div>

      {/* Bottom notch tab */}
      <div
        className="absolute bottom-0 left-8 w-7 h-[3px] rounded-t"
        style={{ backgroundColor: color, opacity: 0.75 }}
      />

      {/* Hover hint */}
      <div className="absolute inset-0 flex items-center justify-center bg-surface/85 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded">
        <span className="font-mono text-[9px] font-bold text-on-surface px-1.5 py-0.5 bg-surface border border-outline-variant rounded shadow-sm">
          drag or click
        </span>
      </div>
    </div>
  );
}

// ── Value / expression block card ────────────────────────────────────────────
// Pill shape with a left-side output connector nub — matches Blockly's shape
// for blocks that produce a value (fit into a slot in another block).

function ValueCard({ block, color }: { block: BlockDef; color: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => startDrag(e, block.type)}
      onClick={() => addBlockNearViewport(block.type)}
      title={block.desc}
      className="flex items-center select-none cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-lg transition-all duration-150 group"
    >
      {/* Left output-connector nub */}
      <div
        className="w-[6px] h-[22px] rounded-l-sm shrink-0"
        style={{ backgroundColor: color, opacity: 0.8 }}
      />

      {/* Pill body */}
      <div
        className="flex-1 px-3 py-1.5 rounded-r-full border flex items-center min-h-[30px] relative overflow-hidden"
        style={{ backgroundColor: `${color}18`, borderColor: `${color}50` }}
      >
        <span className="font-mono text-[12px] font-bold" style={{ color }}>
          {block.label}
        </span>

        {/* Hover hint */}
        <div className="absolute inset-0 flex items-center justify-center bg-surface/85 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-full pointer-events-none">
          <span className="font-mono text-[9px] font-bold text-on-surface px-1.5 py-0.5 bg-surface border border-outline-variant rounded shadow-sm">
            drag or click
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function LogicPanel() {
  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((group) => (
        <div key={group.name} className="flex flex-col gap-1.5">
          {/* Group header */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              {group.name}
            </span>
          </div>

          {/* Blocks */}
          {group.blocks.map((block) =>
            block.shape === 'value' ? (
              <ValueCard key={block.type} block={block} color={group.color} />
            ) : (
              <StatementCard key={block.type} block={block} color={group.color} />
            )
          )}
        </div>
      ))}

      {/* Usage hint */}
      <div className="mt-1 px-2 py-2 rounded border border-dashed border-outline-variant/40">
        <p className="font-mono text-[9px] text-on-surface-variant/50 text-center leading-snug">
          Drag to canvas · click to place near viewport
        </p>
      </div>
    </div>
  );
}
