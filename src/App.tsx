/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LeftPanel from './components/LeftPanel';
import CenterPanel from './components/CenterPanel';
import RightPanel from './components/RightPanel';
import type { NavTab, RightTab, CenterView } from './types';
import { useCircuitStore } from './store';

export default function App() {
  const [activeNav, setActiveNav] = useState<NavTab>('assistant');
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('code');
  const [centerView, setCenterView] = useState<CenterView>('blocks');

  const { plan, selectedOptionId, approved } = useCircuitStore();

  useEffect(() => {
    if (plan) {
      // Plan just arrived → show the plan node graph; right panel shows assembly guide
      setCenterView('plan');
      setActiveRightTab('guide');
    } else if (selectedOptionId && !plan) {
      // Option selected, no plan yet → show blocks canvas (with pending overlay) + code tab
      setCenterView('blocks');
      setActiveRightTab('code');
    } else if (activeNav === 'logic') {
      setCenterView('blocks');
      setActiveRightTab('code');
    } else if (activeNav === 'assistant' && !selectedOptionId) {
      setCenterView('blocks');
    }
    // When approved changes, no view switch needed — overlays just disappear
  }, [activeNav, plan, selectedOptionId, approved]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background selection:bg-secondary selection:text-on-secondary">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />
        <div className="flex-1 flex overflow-hidden bg-primary-container">
          <LeftPanel activeNav={activeNav} />
          <CenterPanel view={centerView} />
          <RightPanel activeTab={activeRightTab} setActiveTab={setActiveRightTab} />
        </div>
      </main>
    </div>
  );
}
