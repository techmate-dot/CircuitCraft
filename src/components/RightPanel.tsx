import { Copy, Cpu, ShieldCheck, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import type { RightTab } from '../types';
import Editor from '@monaco-editor/react';
import { useCircuitStore } from '../store';
import { resolvePinAssignments } from '../lib/pinMapper';
import { generateArduinoCode } from '../lib/codeGen';
import { useState } from 'react';

interface RightPanelProps {
  activeTab: RightTab;
  setActiveTab: (tab: RightTab) => void;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: 'validated' | 'verify_manually' }) {
  if (confidence === 'validated') {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary">
        <ShieldCheck size={10} />
        <span className="font-mono text-[9px] font-medium tracking-wide uppercase">Validated</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary/15 border border-tertiary/30 text-tertiary animate-pulse">
      <ShieldAlert size={10} />
      <span className="font-mono text-[9px] font-medium tracking-wide uppercase">Verify Manually</span>
    </div>
  );
}

// ─── Module H: Pending-Review overlay (code panel) ───────────────────────────
function PendingReviewOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 p-5 bg-surface border border-outline-variant rounded-xl shadow-xl max-w-[220px] text-center">
        <Lock size={18} className="text-tertiary" />
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary font-bold">Pending Review</span>
          <span className="text-xs text-on-surface-variant leading-snug">
            Approve the architecture in the Copilot to unlock this panel.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RightPanel({ activeTab, setActiveTab }: RightPanelProps) {
  const { options, selectedOptionId, validation, approved, generatedCode } = useCircuitStore();
  const selectedOption = options.find(o => o.id === selectedOptionId);
  const assignments = selectedOption ? resolvePinAssignments(selectedOption) : [];
  const confidence = validation?.confidence ?? 'verify_manually';

  return (
    <div className="w-full h-full border-l border-outline-variant flex flex-col bg-surface">
      {/* Tabbed Header */}
      <div className="h-12 border-b border-outline-variant flex items-end px-2 shrink-0 bg-surface-container-low gap-2">
        {(['code', 'mapping', 'guide'] as RightTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 border-b-2 font-mono text-[11px] font-medium tracking-[0.05em] uppercase transition-colors rounded-t ${
              activeTab === tab
                ? 'border-secondary text-secondary bg-surface'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab === 'code' ? 'C++ Code' : tab === 'mapping' ? 'Pin Mapping' : 'Assembly Guide'}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-surface p-4 relative">
        {activeTab === 'code'    && <CodeView assignments={assignments} option={selectedOption} confidence={confidence} approved={approved} generatedCode={generatedCode} />}
        {activeTab === 'guide'   && <AssemblyGuideView assignments={assignments} confidence={confidence} approved={approved} />}
        {activeTab === 'mapping' && <PinMappingExpandedView assignments={assignments} confidence={confidence} />}
      </div>

      {/* Persistent Pin Mapping Bottom Table */}
      {(activeTab === 'code' || activeTab === 'guide') && (
        <div className="h-1/3 border-t border-outline-variant bg-surface flex flex-col shrink-0 min-h-[180px]">
          <div className="p-2 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
            <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant">Active Pins</span>
            <div className="flex items-center gap-2">
              {selectedOption && <ConfidenceBadge confidence={confidence} />}
              {approved && <CheckCircle2 size={12} className="text-secondary" />}
              <Cpu size={16} className="text-on-surface-variant" />
            </div>
          </div>
          <div className="overflow-y-auto p-panel-padding">
            {assignments.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic py-2">Select an architecture option to see pin assignments.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="font-mono text-[11px] uppercase tracking-[0.05em] text-on-surface-variant pb-1 font-normal">Component</th>
                    <th className="font-mono text-[11px] uppercase tracking-[0.05em] text-on-surface-variant pb-1 font-normal">Pin</th>
                    <th className="font-mono text-[11px] uppercase tracking-[0.05em] text-on-surface-variant pb-1 font-normal">Type</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[13px] text-on-surface">
                  {assignments.map((a, i) => (
                    <tr key={i} className="border-b border-outline-variant/50 hover:bg-surface-container transition-colors">
                      <td className="py-1.5">{a.component}</td>
                      <td className={`py-1.5 ${a.pin === 'UNASSIGNED' ? 'text-error' : 'text-tertiary'}`}>{a.pin}</td>
                      <td className="py-1.5 text-on-surface-variant text-[11px]">{a.pinType.toUpperCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Code View — Monaco with generated Arduino C++ (Module H: locked until approved) ──
function CodeView({
  assignments,
  option,
  confidence,
  approved,
  generatedCode,
}: {
  assignments: ReturnType<typeof resolvePinAssignments>;
  option: any;
  confidence: 'validated' | 'verify_manually';
  approved: boolean;
  generatedCode: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const { setGeneratedCode } = useCircuitStore();

  const code = generatedCode
    ? generatedCode
    : (option
      ? generateArduinoCode(assignments, option.label, confidence)
      : `// Select an architecture option in the Copilot panel to generate code.\n// Pin numbers are validated against the component spec table before appearing here.`);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Code header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-surface border-b border-outline-variant/40">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
            Arduino C++ · Milestone 1
          </span>
          {option && <ConfidenceBadge confidence={confidence} />}
          {approved && (
            <div className="flex items-center gap-1 text-secondary">
              <CheckCircle2 size={11} />
              <span className="font-mono text-[9px] uppercase tracking-wider">Approved</span>
            </div>
          )}
        </div>
        <button
          onClick={handleCopy}
          disabled={!approved}
          className="flex items-center gap-1.5 p-1.5 text-on-surface-variant hover:text-secondary hover:bg-surface-container rounded transition-colors disabled:opacity-30"
          title={approved ? 'Copy Code' : 'Approve to unlock'}
        >
          {copied ? <CheckCircle2 size={14} className="text-secondary" /> : <Copy size={14} />}
          <span className="font-mono text-[10px]">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* verify_manually overlay banner (only after approval) */}
      {approved && confidence === 'verify_manually' && option && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-tertiary/8 border-b border-tertiary/20">
          <ShieldAlert size={12} className="text-tertiary shrink-0" />
          <span className="text-[11px] text-tertiary font-mono">
            Warnings acknowledged — review before flashing to hardware
          </span>
        </div>
      )}

      {/* Manual edit disclosure banner (only after approval) */}
      {approved && option && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-secondary/8 border-b border-secondary/20">
          <CheckCircle2 size={12} className="text-secondary shrink-0" />
          <span className="text-[11px] text-secondary font-mono">
            Note: Manual edits to code do not parse back into Blockly blocks.
          </span>
        </div>
      )}

      {/* Monaco editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="cpp"
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
            readOnly: !approved,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
          }}
          value={code}
          onChange={(val) => {
            if (val !== undefined) {
              setGeneratedCode(val);
            }
          }}
        />
        {/* Module H: overlay until approved */}
        {!approved && option && <PendingReviewOverlay />}
      </div>
    </div>
  );
}

// ─── Assembly Guide View ──────────────────────────────────────────────────────
function AssemblyGuideView({
  assignments,
  confidence,
  approved,
}: {
  assignments: ReturnType<typeof resolvePinAssignments>;
  confidence: 'validated' | 'verify_manually';
  approved: boolean;
}) {
  if (assignments.length === 0) {
    return (
      <div className="flex flex-col gap-2 text-sm text-on-surface-variant italic">
        Select an architecture option to generate the assembly guide.
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Lock size={20} className="text-tertiary" />
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary font-bold">Pending Review</span>
          <span className="text-sm text-on-surface-variant">
            Approve the architecture in the Copilot to unlock the assembly guide.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-medium text-on-surface">Wiring Guide — Milestone 1</h2>
          <ConfidenceBadge confidence={confidence} />
        </div>
        <p className="text-sm text-on-surface-variant">Step-by-step wiring for each validated component.</p>
      </div>

      <div className="flex flex-col gap-4">
        {assignments.map((a, i) => (
          <div key={i} className="flex items-start gap-4 p-4 bg-surface-container rounded border border-outline-variant">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-secondary text-on-secondary font-bold text-[12px] shrink-0">{i + 1}</div>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-on-surface text-sm">{a.component}</span>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-outline-variant bg-surface text-on-surface-variant uppercase">{a.pinType}</span>
              </div>
              {a.pin === 'UNASSIGNED' ? (
                <span className="text-sm text-error">⚠ No pin could be assigned — board may be out of {a.pinType} pins.</span>
              ) : (
                <span className="text-sm text-on-surface-variant">
                  Connect {a.component} signal to <span className="font-mono text-tertiary font-bold">{a.pin}</span> ({a.role}).
                  {a.pinType === 'i2c' && ' Also connect SDA to GPIO21 and SCL to GPIO22 for I2C.'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pin Mapping Expanded View ────────────────────────────────────────────────
function PinMappingExpandedView({
  assignments,
  confidence,
}: {
  assignments: ReturnType<typeof resolvePinAssignments>;
  confidence: 'validated' | 'verify_manually';
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[18px] font-medium text-on-surface">Complete Pin Mapping</h2>
        <ConfidenceBadge confidence={confidence} />
      </div>
      <p className="text-sm text-on-surface-variant">
        {assignments.length === 0
          ? 'Select an architecture option in the Copilot to populate the pin map.'
          : 'All assigned pins for the current validated configuration. Pin numbers are derived from the component spec table — never from raw LLM output.'}
      </p>

      {assignments.length > 0 && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant pb-2">Component</th>
              <th className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant pb-2">Pin</th>
              <th className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant pb-2">Type</th>
              <th className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-on-surface-variant pb-2">Role</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px] text-on-surface">
            {assignments.map((a, i) => (
              <tr key={i} className="border-b border-outline-variant/50 hover:bg-surface-container transition-colors">
                <td className="py-3">{a.component}</td>
                <td className={`py-3 font-bold ${a.pin === 'UNASSIGNED' ? 'text-error' : 'text-tertiary'}`}>{a.pin}</td>
                <td className="py-3 text-on-surface-variant uppercase text-[11px]">{a.pinType}</td>
                <td className="py-3 text-on-surface-variant capitalize text-[11px]">{a.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
