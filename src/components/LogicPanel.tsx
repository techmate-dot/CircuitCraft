/**
 * LogicPanel — draggable control-flow, timing, logic, math, and serial blocks.
 *
 * Block shapes:
 *   Statement blocks → puzzle piece (notch at top, tab at bottom) via clip-path
 *   Value / expression blocks → pointed left connector + pill body
 *
 * Placement:
 *   Drag onto canvas → block appears at exact drop position (via workspaceRef)
 *   Click            → block placed near top-left of visible viewport
 */

import { addBlockNearViewport } from '../lib/workspaceRef';

// ── Puzzle-piece geometry (all in px, notch/tab at fixed pixel offsets) ───────
const NX = 12;   // notch/tab start X
const NW = 20;   // notch/tab width
const NH = 8;    // notch/tab height
const BH = 36;   // block body height
const TOTAL = NH + BH + NH;   // 52px: notch-space + body + tab

// clip-path polygon for statement blocks.
// Uses 0% / 100% for the full width, fixed px for the notch at x=[NX, NX+NW].
const STATEMENT_CLIP = [
  `0% ${NH}px`,
  `${NX}px ${NH}px`,  `${NX}px 0`,  `${NX + NW}px 0`,  `${NX + NW}px ${NH}px`,
  `100% ${NH}px`,
  `100% ${NH + BH}px`,
  `${NX + NW}px ${NH + BH}px`,  `${NX + NW}px ${TOTAL}px`,  `${NX}px ${TOTAL}px`,  `${NX}px ${NH + BH}px`,
  `0% ${NH + BH}px`,
].join(', ');

// ── Block catalog ─────────────────────────────────────────────────────────────
interface BlockDef {
  type: string;
  label: string;
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
      { type: 'controls_if',         label: 'if … do',          shape: 'statement', desc: 'Run code only when a condition is true' },
      { type: 'controls_repeat_ext', label: 'repeat N times',   shape: 'statement', desc: 'Loop N times (use a Math block for N)' },
      { type: 'controls_whileUntil', label: 'while … do',       shape: 'statement', desc: 'Loop while / until a condition holds' },
      { type: 'controls_for',        label: 'count from … to',  shape: 'statement', desc: 'For-loop with start, end, and step' },
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
      { type: 'hardware_serial_print', label: 'Serial.println', shape: 'statement', desc: 'Print text to the Serial monitor' },
    ],
  },
];

// ── Drag helper ───────────────────────────────────────────────────────────────
function startDrag(e: React.DragEvent, blockType: string) {
  e.dataTransfer.setData('application/x-circuit-block', blockType);
  e.dataTransfer.effectAllowed = 'copy';
}

// ── Statement block (puzzle piece) ───────────────────────────────────────────
// Outer div carries `filter: drop-shadow` so the shadow follows the clipped
// shape (applying filter on the same element as clip-path would shadow the
// pre-clip bounding box, not the puzzle silhouette).

function StatementCard({ block, color }: { block: BlockDef; color: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => startDrag(e, block.type)}
      onClick={() => addBlockNearViewport(block.type)}
      title={`${block.desc}\nDrag to canvas or click to add`}
      className="select-none cursor-grab active:cursor-grabbing group hover:brightness-125 transition-all duration-100"
      style={{ filter: `drop-shadow(0 0 1px ${color}) drop-shadow(0 2px 6px rgba(0,0,0,0.7))` }}
    >
      <div
        style={{
          height: TOTAL,
          backgroundColor: '#111215',
          clipPath: `polygon(${STATEMENT_CLIP})`,
        }}
      >
        <div
          className="flex items-center font-mono text-[12px] font-bold"
          style={{
            paddingTop: NH,
            paddingLeft: 12,
            paddingRight: 8,
            height: '100%',
            color,
          }}
        >
          {block.label}
        </div>
      </div>
    </div>
  );
}

// ── Value / expression block (pill with left connector) ───────────────────────
// A CSS-border triangle creates the left "output" connector nub.
// The outer wrapper carries the drop-shadow filter.

function ValueCard({ block, color }: { block: BlockDef; color: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => startDrag(e, block.type)}
      onClick={() => addBlockNearViewport(block.type)}
      title={`${block.desc}\nDrag to canvas or click to add`}
      className="select-none cursor-grab active:cursor-grabbing flex items-center hover:brightness-125 transition-all duration-100"
      style={{ filter: `drop-shadow(0 0 1px ${color}) drop-shadow(0 2px 6px rgba(0,0,0,0.7))` }}
    >
      {/* Left output connector — CSS border triangle, using color for edge */}
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: '11px solid transparent',
          borderBottom: '11px solid transparent',
          borderRight: `11px solid ${color}`,
          flexShrink: 0,
        }}
      />
      {/* Pill body — dark with colored border */}
      <div
        className="flex items-center font-mono text-[12px] font-bold"
        style={{
          flex: 1,
          height: 32,
          backgroundColor: '#111215',
          border: `1.5px solid ${color}`,
          borderLeft: 'none',
          borderRadius: '0 100px 100px 0',
          paddingLeft: 8,
          paddingRight: 14,
          color,
        }}
      >
        {block.label}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function LogicPanel() {
  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((group) => (
        <div key={group.name} className="flex flex-col gap-2">
          {/* Group header */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              {group.name}
            </span>
          </div>

          {group.blocks.map((block) =>
            block.shape === 'value' ? (
              <ValueCard key={block.type} block={block} color={group.color} />
            ) : (
              <StatementCard key={block.type} block={block} color={group.color} />
            )
          )}
        </div>
      ))}

      <div className="mt-2 px-2 py-2 rounded border border-dashed border-outline-variant/40">
        <p className="font-mono text-[9px] text-on-surface-variant/50 text-center leading-snug">
          Drag to canvas · click to place near viewport
        </p>
      </div>
    </div>
  );
}
