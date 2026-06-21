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
export function addBlockAt(
  blockType: string,
  wsX: number,
  wsY: number,
): boolean {
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
 * Drop a block from an external HTML5 DragEvent onto the workspace.
 * Reads blockType from dataTransfer, converts clientX/Y to workspace coordinates.
 *
 * Accepts a duck-typed event so it works with both native DragEvent and
 * React.DragEvent<HTMLDivElement> without needing to cast at the call site.
 */
export function dropBlockFromEvent(e: {
  clientX: number;
  clientY: number;
  dataTransfer: DataTransfer | null;
}): boolean {
  const blockType =
    e.dataTransfer?.getData('application/x-circuit-block') ?? '';
  if (!blockType || !_ws) return false;

  const svg = _ws.getParentSvg() as SVGSVGElement;
  const ctm = _ws.getInverseScreenCTM();

  // Convert client → SVG point using the inverse screen CTM
  let pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  if (ctm) pt = pt.matrixTransform(ctm);

  // Convert SVG point → workspace coordinates (accounts for pan + zoom)
  const metrics = _ws.getMetricsManager().getAbsoluteMetrics();
  const scale = _ws.getScale();
  const wsX = (pt.x - metrics.left) / scale + (_ws as any).scrollX;
  const wsY = (pt.y - metrics.top) / scale + (_ws as any).scrollY;

  return addBlockAt(blockType, wsX, wsY);
}

/**
 * Place a block near the top-left of the visible workspace viewport.
 * Used when the user clicks a block in the panel rather than dragging it.
 * getViewMetrics(true) returns bounds in workspace coordinates.
 */
export function addBlockNearViewport(blockType: string): boolean {
  if (!_ws) return false;

  const vm = (_ws.getMetricsManager().getViewMetrics as any)(true) ??
             _ws.getMetricsManager().getViewMetrics();
  const wsX = ((vm as any).left ?? 40) + 40;
  const wsY = ((vm as any).top  ?? 40) + 80;

  return addBlockAt(blockType, wsX, wsY);
}
