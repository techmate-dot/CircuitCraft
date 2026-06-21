/**
 * CustomBlockPanel — on-demand block generation
 *
 * Appears when the user clicks "Generate Block…" at the bottom of any
 * toolbox category flyout.
 *
 * Flow:
 *   1. User types ≥ 2 chars → fuzzy-search the static + custom ComponentSpec
 *      table (zero AI tokens, instant).
 *   2. Match found → "Add to canvas" places an existing registered block.
 *   3. No match → "Generate with AI" calls POST /api/spec which returns
 *      a ComponentSpec.  registerRuntimeBlock() converts it to a Blockly block
 *      + Arduino generator entry deterministically. No raw Blockly JSON or
 *      raw code ever comes from the LLM.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Zap, Check, Loader2, AlertCircle, Cpu } from 'lucide-react';
import type { ComponentSpec } from '../data/components';
import { COMPONENTS } from '../data/components';
import { useCircuitStore } from '../store';
import { registerRuntimeBlock } from '../lib/registerRuntimeBlock';

interface CustomBlockPanelProps {
  /** Category that was open when the user clicked "Generate Block…" */
  category: string;
  onClose: () => void;
  /** Called when a spec is ready — caller adds a block to the workspace */
  onBlockReady: (spec: ComponentSpec) => void;
}

type Status = 'idle' | 'generating' | 'success' | 'error';

export default function CustomBlockPanel({
  category,
  onClose,
  onBlockReady,
}: CustomBlockPanelProps) {
  const [query, setQuery]       = useState('');
  const [status, setStatus]     = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef                = useRef<HTMLInputElement>(null);

  const { customComponents, aiProvider } = useCircuitStore();
  const allSpecs: ComponentSpec[] = [...COMPONENTS, ...customComponents];

  // Fuzzy search: name and notes, case-insensitive substring match
  const q       = query.trim().toLowerCase();
  const matches = q.length < 2
    ? []
    : allSpecs.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.notes.toLowerCase().includes(q)
      );
  const noMatch   = q.length >= 2 && matches.length === 0;
  const searching = q.length >= 2;

  // Focus input and wire ESC key
  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAdd = useCallback(
    (spec: ComponentSpec) => {
      onBlockReady(spec);
      onClose();
    },
    [onBlockReady, onClose],
  );

  const handleAIGenerate = async () => {
    setStatus('generating');
    setErrorMsg('');
    try {
      const res = await fetch('/api/spec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Provider': aiProvider,
        },
        body: JSON.stringify({ componentName: query.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Failed to generate component spec');
      }

      const spec: ComponentSpec = await res.json();

      // Register the block + Arduino generator deterministically from the spec
      registerRuntimeBlock(spec);

      // Persist the spec in the store so the toolbox callbacks can surface it
      useCircuitStore.getState().addCustomComponent(spec);

      setStatus('success');
      onBlockReady(spec);
      setTimeout(onClose, 700);
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message ?? 'Generation failed. Please try again.');
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center pt-16">
      {/* Click-outside backdrop */}
      <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-[420px] bg-surface border border-outline-variant rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-low">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-secondary" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface">
              Find or Generate Block
            </span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-secondary/30 bg-secondary/10 text-secondary uppercase">
              {category}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 border-b border-outline-variant">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-container rounded border border-outline-variant focus-within:border-secondary transition-colors">
            <Search size={12} className="text-on-surface-variant shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setStatus('idle');
                setErrorMsg('');
              }}
              placeholder="Component name — MQ-2, NeoPixel, HC-05, RFID…"
              className="flex-1 bg-transparent outline-none font-mono text-[12px] text-on-surface placeholder-on-surface-variant/40"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X size={10} />
              </button>
            )}
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-on-surface-variant/50">
            Searches the local library first — AI only runs for unknown components (costs tokens).
          </p>
        </div>

        {/* Result area */}
        <div className="overflow-y-auto" style={{ maxHeight: '300px' }}>
          {/* Prompt to type */}
          {!searching && (
            <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
              <Cpu size={20} className="text-on-surface-variant/30" />
              <span className="font-mono text-[11px] text-on-surface-variant/50">
                Type a component name to search the library
              </span>
            </div>
          )}

          {/* Matches */}
          {matches.length > 0 && (
            <div className="p-2 flex flex-col gap-1">
              {matches.map(spec => (
                <button
                  key={spec.name}
                  onClick={() => handleAdd(spec)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-container border border-transparent hover:border-outline-variant transition-colors text-left group w-full"
                >
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="font-mono text-[12px] font-bold text-on-surface">
                      {spec.name.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant truncate">
                      {spec.notes}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-outline-variant text-on-surface-variant">
                      {spec.category}
                    </span>
                    <span className="font-mono text-[10px] text-secondary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Add →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No match → offer AI generation */}
          {noMatch && (
            <div className="px-4 py-5 flex flex-col gap-3">
              <p className="font-mono text-[11px] text-on-surface-variant text-center">
                <strong className="text-on-surface">"{query}"</strong> not found in the component library.
              </p>

              <button
                onClick={handleAIGenerate}
                disabled={status === 'generating' || status === 'success'}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-secondary/40 bg-secondary/10 text-secondary font-mono text-[11px] font-bold hover:bg-secondary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'generating' ? (
                  <><Loader2 size={12} className="animate-spin" /> Generating ComponentSpec…</>
                ) : status === 'success' ? (
                  <><Check size={12} /> Block registered!</>
                ) : (
                  <><Zap size={12} /> Generate block with AI</>
                )}
              </button>

              {status === 'error' && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg border border-error/30 bg-error/8">
                  <AlertCircle size={12} className="text-error shrink-0 mt-0.5" />
                  <span className="font-mono text-[10px] text-error leading-snug">{errorMsg}</span>
                </div>
              )}

              <div className="px-2 py-2 rounded-lg bg-surface-container border border-outline-variant/50">
                <p className="font-mono text-[10px] text-on-surface-variant/70 leading-relaxed">
                  AI generates component <em>metadata</em> only (pin type, voltage, current).
                  The block shape and Arduino code template are derived from it
                  deterministically — no raw code comes from the LLM.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
