import {
  Bot, HelpCircle, Lightbulb, CheckCircle2, AlertTriangle,
  AlertCircle, Zap, DollarSign, Layers, Battery, RefreshCw, ShieldX,
  ClipboardCheck, MapPin, TriangleAlert, ShieldAlert,
} from 'lucide-react';
import { useCircuitStore } from '../store';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import type { ChatMessage } from '../store';
import type { ArchitectureOption } from '../types';
import type { RuleViolation } from '../data/components';

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
        className={`p-3 rounded-lg border text-sm max-w-[92%] ${isUser
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
function ClarifyCard({
  intent,
  onToggleChip,
  selectedChips,
}: {
  intent: import('../types').IntentObject;
  onToggleChip: (answer: string) => void;
  selectedChips: string[];
}) {
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/40 pt-3">
      {intent.missing_info.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-tertiary mb-0.5">
            <HelpCircle size={13} />
            <span className="font-mono text-[10px] uppercase tracking-wider">Pick answers · then press Enter</span>
          </div>
          {intent.missing_info.map((q: any, i) => {
            const questionStr = typeof q === 'string' ? q : q.question;
            const suggestedAnswers = (typeof q === 'object' && Array.isArray(q.suggestedAnswers)) ? q.suggestedAnswers : [];

            return (
              <div key={i} className="flex flex-col gap-1.5 p-2 rounded bg-tertiary/8 border border-tertiary/20">
                <div className="flex gap-2 items-start text-xs text-on-surface">
                  <span className="text-tertiary font-bold shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{questionStr}</span>
                </div>
                {suggestedAnswers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-4">
                    {suggestedAnswers.map((ans: string, j: number) => {
                      const isSelected = selectedChips.includes(ans);
                      return (
                        <button
                          key={j}
                          type="button"
                          onClick={() => onToggleChip(ans)}
                          className={`font-mono text-[10px] px-2 py-1 rounded border transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-tertiary bg-tertiary/30 text-tertiary ring-1 ring-tertiary/50'
                              : 'border-tertiary/40 bg-tertiary/8 text-tertiary/80 hover:bg-tertiary/20 hover:text-tertiary'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{ans}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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

// ─── Rule ID badge ─────────────────────────────────────────────────────────────
function RuleIdBadge({ ruleId }: { ruleId: string }) {
  return (
    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-current bg-current/10 shrink-0 tracking-wider font-bold">
      {ruleId}
    </span>
  );
}

// ─── Single violation row ──────────────────────────────────────────────────────
function ViolationRow({ v }: { v: RuleViolation }) {
  const isConflict = v.severity === 'conflict';
  return (
    <div
      className={`flex gap-2 p-2 rounded items-start text-xs ${isConflict ? 'text-error bg-error/10 border border-error/20' : 'text-tertiary bg-tertiary/10 border border-tertiary/20'
        }`}
    >
      {isConflict
        ? <AlertCircle size={13} className="mt-0.5 shrink-0" />
        : <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      }
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-center gap-1.5">
          <RuleIdBadge ruleId={v.ruleId} />
          <span className="font-mono text-[9px] uppercase tracking-wider opacity-70">
            {isConflict ? 'conflict' : 'warning'}
          </span>
        </div>
        <span className="leading-snug">{v.message}</span>
        {v.components.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {v.components.map((c, i) => (
              <span key={i} className="font-mono text-[9px] px-1 py-0.5 rounded bg-current/10 border border-current/20">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tradeoff row ─────────────────────────────────────────────────────────────
const TRADEOFF_META = [
  { key: 'cost', label: 'Cost', Icon: DollarSign },
  { key: 'portability', label: 'Portability', Icon: Zap },
  { key: 'complexity', label: 'Complexity', Icon: Layers },
  { key: 'power', label: 'Power', Icon: Battery },
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
      id={`option-card-${opt.id}`}
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

// ─── Validation widget — consumes RuleViolation[] with rule IDs ───────────────
function ValidationWidget() {
  const { validation, pipelineState, transitionTo, isLoading } = useCircuitStore();
  const [acknowledged, setAcknowledged] = useState(false);

  if (!validation) return null;

  const conflicts = validation.violations.filter(v => v.severity === 'conflict');
  const warnings = validation.violations.filter(v => v.severity === 'warning');
  const approved = ['PLAN_GENERATING', 'AWAITING_APPROVAL', 'APPROVED'].includes(pipelineState);

  const hasIssues = conflicts.length > 0 || warnings.length > 0;
  const canApprove = conflicts.length === 0 && (!hasIssues || acknowledged);

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/40 pt-3">
      {/* Validation summary badge */}
      <div className="flex items-center gap-2">
        {conflicts.length === 0 && warnings.length === 0 ? (
          <div className="flex items-center gap-1.5 text-secondary text-xs">
            <CheckCircle2 size={13} />
            <span className="font-mono font-bold">All DRC rules passed</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <ShieldX size={13} />
            <span className="font-mono">
              {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
              {warnings.length > 0 && `, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </div>

      {/* Conflicts — block approval */}
      {conflicts.map((v, i) => <ViolationRow key={i} v={v} />)}

      {/* Warnings — require acknowledgement */}
      {warnings.map((v, i) => <ViolationRow key={i} v={v} />)}

      {/* Only show controls if not yet approved */}
      {!approved && (
        <div className="flex flex-col gap-2 mt-1">
          {hasIssues && warnings.length > 0 && conflicts.length === 0 && (
            <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="accent-secondary"
                id="ack-warnings-checkbox"
              />
              I have reviewed and acknowledge the warnings above
            </label>
          )}
          {conflicts.length === 0 ? (
            <button
              id="approve-plan-button"
              disabled={!canApprove || isLoading}
              onClick={() => {
                transitionTo('PLAN_GENERATING');
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

// ─── Plan Review Widget — APPROVE_FINAL gate (Module H) ─────────────────────────────
// This is the ONLY way to transition AWAITING_APPROVAL → APPROVED.
// Hard Rule 4: never auto-advance past a decision point.
function PlanReviewWidget() {
  const { pipelineState, transitionTo, plan } = useCircuitStore();
  const isAwaitingApproval = pipelineState === 'AWAITING_APPROVAL';
  const isApproved = pipelineState === 'APPROVED';

  if (!plan) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/40 pt-3">
      {/* Plan summary: milestone count */}
      <div className="flex items-center gap-1.5 text-secondary text-xs">
        <MapPin size={12} />
        <span className="font-mono">
          {plan.milestones.length} milestones generated — Milestone 1 is the active build step
        </span>
      </div>

      {/* Milestone titles preview */}
      <div className="flex flex-col gap-1">
        {plan.milestones.map((m, i) => (
          <div key={m.id} className={`flex items-center gap-2 text-xs ${i === 0 ? 'text-secondary font-bold' : 'text-on-surface-variant'
            }`}>
            <span className={`font-mono text-[9px] w-5 shrink-0 ${i === 0 ? 'text-secondary' : 'text-on-surface-variant'
              }`}>M{i + 1}</span>
            <span className="truncate">{m.title}</span>
            {i === 0 && (
              <span className="font-mono text-[8px] px-1 py-0.5 rounded bg-secondary text-on-secondary uppercase tracking-wider shrink-0">Active</span>
            )}
          </div>
        ))}
      </div>

      {/* APPROVE_FINAL action — the explicit gate */}
      {isAwaitingApproval && (
        <button
          id="mark-reviewed-button"
          onClick={() => transitionTo('APPROVED')}
          className="flex items-center gap-1.5 bg-secondary text-on-secondary px-3 py-2 rounded text-xs font-bold hover:bg-secondary-fixed transition-colors mt-1"
        >
          <ClipboardCheck size={13} />
          Mark as Reviewed — Unlock Diagram &amp; Code
        </button>
      )}

      {/* Post-approval confirmation */}
      {isApproved && (
        <div className="flex items-center gap-1.5 text-secondary text-xs mt-1">
          <CheckCircle2 size={12} />
          <span>Plan reviewed — diagram and code panels are unlocked.</span>
        </div>
      )}
    </div>
  );
}

// ─── Risk Analysis card — shown after architecture approval ──────────────────
type Risk = { title: string; severity: 'low' | 'medium' | 'high'; description: string; mitigation: string };

function RiskCard({ risks }: { risks: Risk[] }) {
  const severityStyle: Record<string, string> = {
    high:   'text-error bg-error/10 border-error/25',
    medium: 'text-tertiary bg-tertiary/10 border-tertiary/25',
    low:    'text-on-surface-variant bg-surface-container border-outline-variant/40',
  };
  const SeverityIcon = ({ s }: { s: string }) =>
    s === 'high'   ? <AlertCircle size={12} className="shrink-0 mt-0.5" /> :
    s === 'medium' ? <TriangleAlert size={12} className="shrink-0 mt-0.5" /> :
                     <ShieldAlert size={12} className="shrink-0 mt-0.5" />;

  if (!risks || risks.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/40 pt-3">
      <div className="flex items-center gap-1.5 text-tertiary mb-0.5">
        <ShieldAlert size={13} />
        <span className="font-mono text-[10px] uppercase tracking-wider">Build Risk Report · {risks.length} item{risks.length !== 1 ? 's' : ''}</span>
      </div>
      {risks.map((r, i) => (
        <div key={i} className={`flex flex-col gap-1 p-2.5 rounded border text-xs ${severityStyle[r.severity] ?? severityStyle.low}`}>
          <div className="flex items-start gap-1.5">
            <SeverityIcon s={r.severity} />
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">{r.title}</span>
                <span className={`font-mono text-[8px] uppercase tracking-wider px-1 py-0.5 rounded border border-current/30 bg-current/5`}>{r.severity}</span>
              </div>
              <span className="text-on-surface-variant leading-snug">{r.description}</span>
            </div>
          </div>
          <div className="flex items-start gap-1.5 mt-0.5 pl-4 text-[10px] opacity-80">
            <span className="text-secondary shrink-0">→</span>
            <span className="leading-snug">{r.mitigation}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error card — shown when schema validation fails after retry ───────────────
function ErrorCard({ message }: { message: string }) {
  const { transitionTo, reset } = useCircuitStore();
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/40 pt-3">
      <div className="flex gap-2 p-3 rounded bg-error/10 border border-error/20 items-start text-xs text-error">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="font-mono font-bold uppercase tracking-wide text-[10px]">AI Response Error</span>
          <span className="leading-snug text-on-surface">{message}</span>
          <span className="text-on-surface-variant text-[10px]">
            The AI returned a malformed response twice. This is rare — please try submitting your idea again.
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => transitionTo('IDLE')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container border border-outline-variant rounded text-xs font-bold hover:bg-surface-container-highest transition-colors"
        >
          <RefreshCw size={11} />
          Try Again
        </button>
        <button
          onClick={() => reset()}
          className="px-2.5 py-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

// ─── Main AssistantContent ────────────────────────────────────────────────────
export default function AssistantContent({
  onToggleChip,
  selectedChips,
}: {
  onToggleChip: (answer: string) => void;
  selectedChips: string[];
}) {
  const { messages, options, selectedOptionId, setSelectedOptionId, intent, clarifyStage, isLoading, pipelineState, pipelineError } = useCircuitStore();

  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg, i) => {
        const isOptionsMsg = msg.type === 'options' && options.length > 0;
        const isClarifyMsg = msg.type === 'clarify' && intent !== null;
        const isValidationMsg = msg.type === 'validation';
        const isErrorMsg = msg.type === 'error';
        const isPlanMsg = msg.type === 'plan';
        const isRisksMsg = msg.type === 'risks';

        return (
          <MessageBubble key={i} msg={msg}>
            {/* Clarify card — visible until user answers */}
            {isClarifyMsg && <ClarifyCard intent={intent!} onToggleChip={onToggleChip} selectedChips={selectedChips} />}

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

            {/* Validation widget — uses RuleViolation[] with rule IDs */}
            {isValidationMsg && <ValidationWidget />}

            {/* Plan review widget */}
            {isPlanMsg && <PlanReviewWidget />}

            {/* Risk analysis card — post-approval */}
            {isRisksMsg && <RiskCard risks={msg.data?.risks ?? []} />}

            {/* Error card — schema validation failed */}
            {isErrorMsg && <ErrorCard message={msg.content} />}
          </MessageBubble>
        );
      })}

      {/* Typing indicator while loading */}
      {(clarifyStage === 'clarifying' || (isLoading && pipelineState !== 'VALIDATING')) && (
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

      {/* Pipeline error banner (from store) */}
      {pipelineState === 'ERROR' && pipelineError && (
        <ErrorCard message={pipelineError.message} />
      )}
    </div>
  );
}
