import { Copy, Cpu, Info } from 'lucide-react';
import type { RightTab } from '../types';
import Editor from '@monaco-editor/react';

interface RightPanelProps {
  activeTab: RightTab;
  setActiveTab: (tab: RightTab) => void;
}

export default function RightPanel({ activeTab, setActiveTab }: RightPanelProps) {
  return (
    <div className="w-[30%] border-l border-outline-variant flex flex-col bg-surface min-w-[320px]">
      {/* Tabbed View Header */}
      <div className="h-12 border-b border-outline-variant flex items-end px-2 shrink-0 bg-surface-container-low gap-2">
        <button 
          onClick={() => setActiveTab('code')}
          className={`px-4 py-2 border-b-2 font-mono text-[11px] font-medium tracking-[0.05em] uppercase transition-colors rounded-t ${
            activeTab === 'code' 
              ? 'border-secondary text-secondary bg-surface' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          C++ Code
        </button>
        <button 
          onClick={() => setActiveTab('mapping')}
          className={`px-4 py-2 border-b-2 font-mono text-[11px] font-medium tracking-[0.05em] uppercase transition-colors rounded-t ${
            activeTab === 'mapping' 
              ? 'border-secondary text-secondary bg-surface' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Pin Mapping
        </button>
        <button 
          onClick={() => setActiveTab('guide')}
          className={`px-4 py-2 border-b-2 font-mono text-[11px] font-medium tracking-[0.05em] uppercase transition-colors rounded-t ${
            activeTab === 'guide' 
              ? 'border-secondary text-secondary bg-surface' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Assembly Guide
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-surface p-4 relative">
        {activeTab === 'code' && <CodeView />}
        {activeTab === 'guide' && <AssemblyGuideView />}
        {activeTab === 'mapping' && <PinMappingExpandedView />}
      </div>

      {/* Persistent Pin Mapping Bottom Table */}
      {(activeTab === 'code' || activeTab === 'guide') && (
        <div className="h-1/3 border-t border-outline-variant bg-surface flex flex-col shrink-0 min-h-[200px]">
          <div className="p-2 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
            <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant">Active Pins</span>
            <Cpu size={16} className="text-on-surface-variant" />
          </div>
          <div className="overflow-y-auto p-panel-padding">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="font-mono text-[11px] uppercase tracking-[0.05em] text-on-surface-variant pb-1 font-normal">Component</th>
                  <th className="font-mono text-[11px] uppercase tracking-[0.05em] text-on-surface-variant pb-1 font-normal">Pin</th>
                  <th className="font-mono text-[11px] uppercase tracking-[0.05em] text-on-surface-variant pb-1 font-normal">GPIO</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px] text-on-surface">
                <tr className="border-b border-outline-variant/50 hover:bg-surface-container transition-colors">
                  <td className="py-2">HC-SR04P (Trig)</td>
                  <td className="py-2 text-tertiary">D5</td>
                  <td className="py-2 text-on-surface-variant">GPIO 5</td>
                </tr>
                <tr className="border-b border-outline-variant/50 hover:bg-surface-container transition-colors">
                  <td className="py-2">HC-SR04P (Echo)</td>
                  <td className="py-2 text-tertiary">D18</td>
                  <td className="py-2 text-on-surface-variant">GPIO 18</td>
                </tr>
                <tr className="hover:bg-surface-container transition-colors">
                  <td className="py-2">Power</td>
                  <td className="py-2 text-error">VIN</td>
                  <td className="py-2 text-on-surface-variant">5V</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeView() {
  const code = `// Validated Hardware Setup
#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  // Auto-generated pin assignments based on validated options
}

void loop() {
  // Logic from blockly diagram
}`;

  return (
    <div className="absolute inset-0">
      <Editor
        height="100%"
        defaultLanguage="cpp"
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: 'JetBrains Mono, monospace',
        }}
        value={code}
      />
      <button className="absolute top-4 right-6 p-2 bg-surface border border-outline-variant rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors shadow-lg z-10" title="Copy Code">
        <Copy size={16} />
      </button>
    </div>
  );
}

function AssemblyGuideView() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[18px] font-medium text-on-surface">Ultrasonic Integration Guide</h2>
        <p className="text-sm text-on-surface-variant">Follow these steps to wire the HC-SR04P sensor to your ESP32 DevKit.</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Step 1 */}
        <div className="flex items-start gap-4 p-4 bg-surface-container rounded border border-outline-variant">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-secondary text-on-secondary font-bold text-[12px] shrink-0">1</div>
          <div className="flex-1 flex flex-col gap-1">
            <span className="font-bold text-on-surface text-sm">VCC/GND Routing</span>
            <span className="text-sm text-on-surface-variant">Connect VCC to 5V (VIN) and GND to any GND pin on the ESP32.</span>
            <div className="flex items-center gap-2 mt-1">
              <input type="checkbox" checked readOnly className="rounded border-outline-variant bg-surface text-secondary focus:ring-0 accent-secondary w-4 h-4" />
              <span className="text-[11px] font-mono text-secondary">Completed</span>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-4 p-4 bg-surface-container rounded border border-outline-variant">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-outline-variant text-on-surface-variant font-bold text-[12px] shrink-0">2</div>
          <div className="flex-1 flex flex-col gap-1">
            <span className="font-bold text-on-surface text-sm">Signal Pins</span>
            <span className="text-sm text-on-surface-variant">Connect Trig to GPIO 5 and Echo to GPIO 18.</span>
            <div className="flex items-center gap-2 mt-1">
              <input type="checkbox" className="rounded border-outline-variant bg-surface text-secondary focus:ring-0 accent-secondary w-4 h-4 cursor-pointer" />
              <span className="text-[11px] font-mono text-on-surface-variant">Mark as done</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pinout info */}
      <div className="p-4 border border-tertiary/30 bg-tertiary/5 rounded flex flex-col gap-2">
        <div className="flex items-center gap-2 text-tertiary mb-2">
          <Info size={18} />
          <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase">HC-SR04 Pinout</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-[11px] font-mono">
          <div className="flex justify-between border-b border-outline-variant/30 pb-1">
            <span className="text-on-surface-variant">VCC</span>
            <span className="text-on-surface">5V</span>
          </div>
          <div className="flex justify-between border-b border-outline-variant/30 pb-1">
            <span className="text-on-surface-variant">Trig</span>
            <span className="text-on-surface">Input</span>
          </div>
          <div className="flex justify-between border-b border-outline-variant/30 pb-1">
            <span className="text-on-surface-variant">Echo</span>
            <span className="text-on-surface">Output</span>
          </div>
          <div className="flex justify-between border-b border-outline-variant/30 pb-1">
            <span className="text-on-surface-variant">GND</span>
            <span className="text-on-surface">0V</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PinMappingExpandedView() {
  return (
    <div className="flex flex-col gap-4">
       <h2 className="font-display text-[18px] font-medium text-on-surface mb-2">Complete Pin Mapping</h2>
       <p className="text-sm text-on-surface-variant mb-4">A comprehensive list of all assigned pins for the current project configuration.</p>
       <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant">
            <th className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant pb-2">Component</th>
            <th className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant pb-2">Pin</th>
            <th className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant pb-2">GPIO</th>
            <th className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant pb-2">Type</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px] text-on-surface">
          <tr className="border-b border-outline-variant/50 hover:bg-surface-container transition-colors">
            <td className="py-3">HC-SR04P (Trig)</td>
            <td className="py-3 text-tertiary">D5</td>
            <td className="py-3 text-on-surface-variant">GPIO 5</td>
            <td className="py-3 text-on-surface-variant">Digital Output</td>
          </tr>
          <tr className="border-b border-outline-variant/50 hover:bg-surface-container transition-colors">
            <td className="py-3">HC-SR04P (Echo)</td>
            <td className="py-3 text-tertiary">D18</td>
            <td className="py-3 text-on-surface-variant">GPIO 18</td>
            <td className="py-3 text-on-surface-variant">Digital Input</td>
          </tr>
          <tr className="border-b border-outline-variant/50 hover:bg-surface-container transition-colors">
            <td className="py-3">Built-in LED</td>
            <td className="py-3 text-tertiary">D2</td>
            <td className="py-3 text-on-surface-variant">GPIO 2</td>
            <td className="py-3 text-on-surface-variant">Digital Output</td>
          </tr>
          <tr className="hover:bg-surface-container transition-colors">
            <td className="py-3">Power</td>
            <td className="py-3 text-error">VIN</td>
            <td className="py-3 text-on-surface-variant">5V</td>
            <td className="py-3 text-on-surface-variant">Power Supply</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
