/**
 * workspaceRef.ts
 *
 * Singleton reference to the active Blockly WorkspaceSvg.
 *
 * Why not Zustand? Zustand store should not hold mutable DOM objects —
 * that breaks serialization and React devtools. A plain module-level
 * ref is the idiomatic pattern for sharing a single live DOM reference
 * across sibling components without prop-drilling.
 *
 * Lifecycle: BlocksCanvas sets this on mount / clears on unmount.
 * HardwarePanel and LogicPanel read it to create blocks on click or drop.
 */

import * as Blockly from 'blockly';

let _ws: Blockly.WorkspaceSvg | null = null;

export function setActiveWorkspace(ws: Blockly.WorkspaceSvg | null) {
  _ws = ws;
}

export function getActiveWorkspace(): Blockly.WorkspaceSvg | null {
  return _ws;
}

/**
 * Create a block of the given type at workspace coordinates (wsX, wsY).
 * Safe to call even if no workspace is active — returns false and is a no-op.
 */
export function addBlockAt(blockType: string, wsX: number, wsY: number): boolean {
  if (!_ws) return false;
  try {
    const block = _ws.newBlock(blockType) as any;
    block.initSvg();
    block.moveTo(new Blockly.utils.Coordinate(wsX, wsY));
    _ws.render();
    return true;
  } catch (err) {
    console.warn(`[workspaceRef] Could not create block "${blockType}":`, err);
    return false;
  }
}

/**
 * Drop a block from an HTML5 DragEvent onto the workspace.
 * Reads blockType from dataTransfer, converts clientX/Y → workspace coords.
 *
 * Coordinate derivation (Blockly v13):
 *   workspace.scrollX/Y = SVG-pixel translation of the workspace group,
 *   which already includes the toolbox width offset. This is set via
 *   workspace.translate(x, y) and reflects both the initial toolbox shift
 *   AND any user pan.
 *
 *   block at workspace (wx, wy) → SVG pixels (wx*scale + scrollX, wy*scale + scrollY)
 *   Inverse: wx = (svgX - scrollX) / scale
 *
 * Accepts a duck-typed event so it works with both native DragEvent and
 * React.DragEvent<HTMLDivElement> without casting at the call site.
 */
export function dropBlockFromEvent(e: {
  clientX: number;
  clientY: number;
  dataTransfer: DataTransfer | null;
}): boolean {
  const blockType = e.dataTransfer?.getData('application/x-circuit-block') ?? '';
  if (!blockType || !_ws) return false;

  // Client → SVG pixel offset (SVG is positioned at the blocklyDiv origin)
  const svg = _ws.getParentSvg() as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const svgX = e.clientX - rect.left;
  const svgY = e.clientY - rect.top;

  // SVG pixel → workspace coordinates
  const scale = _ws.getScale();
  const wsX = (svgX - _ws.scrollX) / scale;
  const wsY = (svgY - _ws.scrollY) / scale;

  return addBlockAt(blockType, wsX, wsY);
}

/**
 * Place a block near the top-left of the visible workspace viewport.
 * Used when the user clicks a block in the panel rather than dragging it.
 *
 * getViewMetrics() returns view bounds in workspace coordinates when passed
 * `true` (Blockly v13 API). Falls back to scrollX/Y math if unavailable.
 */
export function addBlockNearViewport(blockType: string): boolean {
  if (!_ws) return false;

  let wsX = 40;
  let wsY = 80;
  try {
    // getViewMetrics(true) = workspace coordinate space
    const vm = (_ws.getMetricsManager().getViewMetrics as any)(true) as any;
    if (vm && typeof vm.left === 'number') {
      wsX = vm.left + 40;
      wsY = vm.top + 40;
    } else {
      // Fallback: infer from scrollX/Y
      const scale = _ws.getScale();
      wsX = (-_ws.scrollX / scale) + 40;
      wsY = (-_ws.scrollY / scale) + 40;
    }
  } catch {
    // Use defaults
  }

  return addBlockAt(blockType, wsX, wsY);
}
