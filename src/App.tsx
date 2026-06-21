/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LeftPanel from './components/LeftPanel';
import CenterPanel from './components/CenterPanel';
import RightPanel from './components/RightPanel';
import type { NavTab, RightTab, CenterView } from './types';
import { useCircuitStore } from './store';

// Resizable side-panel bounds (px). Side widths are always clamped so that
// left + right + MIN_CENTER never exceeds the container — growing one panel
// shrinks the center rather than pushing a panel off-screen.
const MIN_LEFT = 240;
const MIN_RIGHT = 280;
const MIN_CENTER = 340; // also keeps the view toggle clear of Blockly's toolbox
const DIVIDERS = 8;     // two 4px dividers between the three panels

export default function App() {
  const [activeNav, setActiveNav] = useState<NavTab>('assistant');
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('code');
  const [centerView, setCenterView] = useState<CenterView>('blocks');

  // Draggable panel widths. Center is flex-1 and absorbs the remainder.
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Keep both side widths within what the container can actually show.
  const clampWidths = useCallback(() => {
    const cw = containerRef.current?.clientWidth;
    if (!cw) return;
    setLeftWidth((l) => Math.max(MIN_LEFT, Math.min(l, cw - MIN_RIGHT - MIN_CENTER - DIVIDERS)));
    setRightWidth((r) => Math.max(MIN_RIGHT, Math.min(r, cw - MIN_LEFT - MIN_CENTER - DIVIDERS)));
  }, []);

  // Re-clamp on window resize (skip while dragging — the drag handler clamps itself).
  useEffect(() => {
    clampWidths();
    const onResize = () => { if (!draggingRef.current) clampWidths(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampWidths]);

  // Start a drag on one of the two dividers. `side` says which width to adjust.
  const startDrag = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startLeft = leftWidth;
    const startRight = rightWidth;
    const cw = containerRef.current?.clientWidth ?? window.innerWidth;
    draggingRef.current = true;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (side === 'left') {
        // Cap so the center never drops below MIN_CENTER given the current right width.
        const maxLeft = Math.max(MIN_LEFT, cw - rightWidth - MIN_CENTER - DIVIDERS);
        setLeftWidth(Math.max(MIN_LEFT, Math.min(maxLeft, startLeft + dx)));
      } else {
        // Right divider: dragging left grows the right panel.
        const maxRight = Math.max(MIN_RIGHT, cw - leftWidth - MIN_CENTER - DIVIDERS);
        setRightWidth(Math.max(MIN_RIGHT, Math.min(maxRight, startRight - dx)));
      }
      // Let Blockly/Monaco re-fit to their new container size.
      window.dispatchEvent(new Event('resize'));
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const { plan, selectedOptionId, approved } = useCircuitStore();

  useEffect(() => {
    if (selectedOptionId) {
      // Option selected → show blocks + code immediately.
      // Plan tab gets a badge in CenterPanel when plan arrives; user navigates there manually.
      setCenterView('blocks');
      setActiveRightTab('code');
    }
  }, [selectedOptionId]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background selection:bg-secondary selection:text-on-secondary">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />
        <div ref={containerRef} className="flex-1 flex overflow-hidden bg-primary-container">
          <div style={{ width: leftWidth }} className="shrink-0 h-full overflow-hidden">
            <LeftPanel activeNav={activeNav} />
          </div>
          <Divider onMouseDown={startDrag('left')} />
          {/* Center flexes to fill the gap. The JS clamp keeps it >= MIN_CENTER, so
              the view toggle never overlaps Blockly's toolbox; min-w is just a floor. */}
          <div className="flex-1 min-w-[300px] h-full overflow-hidden">
            <CenterPanel view={centerView} />
          </div>
          <Divider onMouseDown={startDrag('right')} />
          <div style={{ width: rightWidth }} className="shrink-0 h-full overflow-hidden">
            <RightPanel activeTab={activeRightTab} setActiveTab={setActiveRightTab} />
          </div>
        </div>
      </main>
    </div>
  );
}

// Thin draggable divider between panels. Widens its hit area on hover and
// shows a col-resize cursor so it reads as a grab handle.
function Divider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to resize"
      className="group relative w-1 shrink-0 cursor-col-resize bg-outline-variant/30 hover:bg-secondary/60 transition-colors"
    >
      {/* invisible wider hit area for easier grabbing */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );
}
