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

export default function App() {
  const [activeNav, setActiveNav] = useState<NavTab>('logic');
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('code');
  // Logic tab naturally pairs with schematic in this design sequence, 
  // Assistant pairs with the blocks canvas as it discusses generating blocks
  const [centerView, setCenterView] = useState<CenterView>('schematic');

  // Synchronize some views for demonstration matching the images
  useEffect(() => {
    if (activeNav === 'logic') {
      setCenterView('schematic');
      setActiveRightTab('code');
    } else if (activeNav === 'assistant') {
      setCenterView('blocks');
      setActiveRightTab('guide');
    }
  }, [activeNav]);

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

