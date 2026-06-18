import { Bot, HelpCircle, Lightbulb, CheckCircle2, AlertTriangle, AlertCircle, Zap, DollarSign, Layers, Battery } from 'lucide-react';
import { useCircuitStore } from '../store';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import type { ChatMessage } from '../store';
import type { ArchitectureOption } from '../types';

// ─── Message bubble wrapper ───────────────────────────────────────────────────
function MessageBubble({ msg, children }: { msg: ChatMessage; children?: React.ReactNode }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <Bot size={13} />
          <span className="font-mono text-[9px] uppercase tracking-widest">AI Copilot · via API</span>
        </div>
      )}
      <div
        className={`p-3 rounded-lg border text-sm max-w-[92%] ${
          isUser
            ? 'bg-secondary/10 border-secondary/25 text-on-surface'
            : 'bg-surface-container border-outline-variant/40'
        }`}
      >
        {msg.role === 'assistant' ? (
          <div className="markdown-body text-sm leading-relaxed">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <span>{msg.content}</span>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── ClarifyCard — shown when missing_info is non-empty ───────────────────────
function ClarifyCard({ intent }: { intent: import('../types').IntentObject }) {
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/40 pt-3">
      {intent.missing_info.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-tertiary mb-0.5">
            <HelpCircle size={13} />
            <span className="font-mono text-[10px] uppercase tracking-wider">Clarifying questions</span>
          </div>
          {intent.missing_info.map((q, i) => (
            <div key={i} className="flex gap-2 items-start p-2 rounded bg-tertiary/8 border border-tertiary/20 text-xs text-on-surface">
              <span className="text-tertiary font-bold shrink-0 mt-0.5">{i + 1}.</span>
              <span>{q}</span>
            </div>
          ))}
        </div>
      )}
      {intent.assumptions.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex items-center gap-1.5 text-secondary mb-0.5">
            <Lightbulb size={13} />
            <span className="font-mono text-[10px] uppercase tracking-wider">My assumptions</span>
          </div>
          {intent.assumptions.map((a, i) => (
            <div key={i} className="flex gap-2 items-start p-2 rounded bg-secondary/8 border border-secondary/20 text-xs text-on-surface-variant">
              <span className="text-secondary shrink-0">→</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tradeoff row ─────────────────────────────────────────────────────────────
const TRADEOFF_META = [
  { key: 'cost',        label: 'Cost',        Icon: DollarSign },
  { key: 'portability', label: 'Portability',  Icon: Zap },
  { key: 'complexity',  label: 'Complexity',   Icon: Layers },
  { key: 'power',       label: 'Power',        Icon: Battery },
] as const;

// ─── OptionCard — one of the two architecture proposals ───────────────────────
function OptionCard({
  opt,
  selected,
  disabled,
  onSelect,
}: {
  opt: ArchitectureOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`
        w-full text-left p-3 rounded-lg border transition-all duration-200 flex flex-col gap-2
        ${selected
          ? 'border-secondary bg-secondary/10 shadow-sm shadow-secondary/10'
          : disabled
            ? 'border-outline-variant/40 opacity-50 cursor-not-allowed'
            : 'border-outline-variant/60 hover:border-secondary/50 hover:bg-surface-container-highest cursor-pointer'
        }
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className={`font-bold text-sm ${selected ? 'text-secondary' : 'text-on-surface'}`}>
            {opt.label}
          </span>
          <span className="text-xs text-on-surface-variant leading-snug">{opt.summary}</span>
        </div>
        {selected && <CheckCircle2 size={16} className="text-secondary shrink-0 mt-0.5" />}
      </div>

      {/* Components list */}
      <div className="flex flex-wrap gap-1">
        {opt.components.map((c) => (
          <span
            key={c}
            className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-outline-variant bg-surface text-on-surface-variant"
          >
            {c}
          </span>
        ))}
      </div>

      {/* Tradeoffs grid */}
      <div className="grid grid-cols-1 gap-1 border-t border-outline-variant/30 pt-2 mt-0.5">
        {TRADEOFF_META.map(({ key, label, Icon }) => (
          <div key={key} className="flex gap-2 items-start text-xs">
            <div className="flex items-center gap-1 w-20 shrink-0 text-on-surface-variant mt-0.5">
              <Icon size={10} />
              <span className="font-mono text-[9px] uppercase tracking-wide">{label}</span>
            </div>
            <span className="text-on-surface leading-snug">{opt.tradeoffs[key]}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

// ─── Validation inline widget ─────────────────────────────────────────────────
function ValidationWidget() {
  const { validation, approved, setApproved, setClarifyStage, isLoading } = useCircuitStore();
  const [acknowledged, setAcknowledged] = useState(false);

  if (!validation) return null;

  const hasIssues = validation.conflicts.length > 0 || validation.warnings.length > 0;
  const canApprove = !hasIssues || acknowledged;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/40 pt-3">
      {/* Conflicts — block approval */}
      {validation.conflicts.map((c, i) => (
        <div key={i} className="flex gap-2 text-error bg-error/10 p-2 rounded items-start text-xs">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{c}</span>
        </div>
      ))}
      {/* Warnings — require acknowledgement */}
      {validation.warnings.map((w, i) => (
        <div key={i} className="flex gap-2 text-tertiary bg-tertiary/10 p-2 rounded items-start text-xs">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{w}</span>
        </div>
      ))}

      {/* Only show controls if not yet approved */}
      {!approved && (
        <div className="flex flex-col gap-2 mt-1">
          {/* Acknowledgement checkbox — only shown when there are issues */}
          {hasIssues && (
            <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="accent-secondary"
              />
              I have reviewed and acknowledge the warnings above
            </label>
          )}
          {/* Conflicts hard-block the button regardless of acknowledgement */}
          {validation.conflicts.length === 0 ? (
            <button
              disabled={!canApprove || isLoading}
              onClick={() => {
                setApproved(true);
                setClarifyStage('option_selected');
                window.dispatchEvent(new CustomEvent('APPROVE_PLAN'));
              }}
              className="bg-secondary text-on-secondary px-3 py-1.5 rounded text-xs font-bold hover:bg-secondary-fixed transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Approve & Generate Plan
            </button>
          ) : (
            <div className="text-xs text-error font-mono bg-error/8 border border-error/20 rounded px-2 py-1.5">
              ✕ Cannot approve — resolve conflicts first
            </div>
          )}
        </div>
      )}

      {/* Post-approval status */}
      {approved && isLoading && (
        <div className="flex gap-1.5 items-center text-secondary text-xs mt-1">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span>Generating milestone plan…</span>
        </div>
      )}
      {approved && !isLoading && (
        <div className="flex gap-1.5 items-center text-secondary text-xs mt-1">
          <CheckCircle2 size={13} />
          <span>Architecture approved — plan generated. See the Plan view.</span>
        </div>
      )}
    </div>
  );
}

// ─── Main AssistantContent ────────────────────────────────────────────────────
export default function AssistantContent() {
  const { messages, options, selectedOptionId, setSelectedOptionId, intent, clarifyStage, isLoading } = useCircuitStore();

  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg, i) => {
        const isOptionsMsg = msg.type === 'options' && options.length > 0;
        const isClarifyMsg = msg.type === 'clarify' && intent !== null;
        const isValidationMsg = msg.type === 'validation';

        return (
          <MessageBubble key={i} msg={msg}>
            {/* Clarify card — visible until user answers */}
            {isClarifyMsg && <ClarifyCard intent={intent!} />}

            {/* Option cards — shown when compare call returns */}
            {isOptionsMsg && (
              <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/40 pt-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">
                  Select one to continue ↓
                </span>
                {options.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    opt={opt}
                    selected={selectedOptionId === opt.id}
                    disabled={!!selectedOptionId && selectedOptionId !== opt.id}
                    onSelect={() => {
                      if (selectedOptionId) return; // locked after first click
                      setSelectedOptionId(opt.id);
                      window.dispatchEvent(new CustomEvent('SELECT_OPTION', { detail: opt }));
                    }}
                  />
                ))}
              </div>
            )}

            {/* Selected confirmation pill */}
            {isOptionsMsg && selectedOptionId && (
              <div className="mt-2 pt-2 border-t border-outline-variant/30 flex items-center gap-1.5 text-secondary text-xs">
                <CheckCircle2 size={12} />
                <span>Selected: {options.find((o) => o.id === selectedOptionId)?.label}</span>
              </div>
            )}

            {/* Validation widget */}
            {isValidationMsg && <ValidationWidget />}
          </MessageBubble>
        );
      })}

      {/* Typing indicator while loading — covers both clarify and plan generation */}
      {(clarifyStage === 'clarifying' || isLoading) && (
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <Bot size={13} />
          <div className="flex gap-1 items-center p-2 bg-surface-container rounded-lg border border-outline-variant/40">
            {[0, 1, 2].map((d) => (
              <div
                key={d}
                className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce"
                style={{ animationDelay: `${d * 120}ms` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
