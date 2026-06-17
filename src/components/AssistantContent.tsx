import { useState } from 'react';
import { Bot, Send, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { useCircuitStore } from '../store';
import ReactMarkdown from 'react-markdown';

export default function AssistantContent() {
  const { messages, options, selectedOptionId, setSelectedOptionId, validation, approved, setApproved } = useCircuitStore();
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg, i) => (
        <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
          {msg.role === 'assistant' && (
            <div className="flex items-center gap-1 text-on-surface-variant">
              <Bot size={14} />
              <span className="font-mono text-[10px] uppercase">AI Assistant</span>
            </div>
          )}
          <div className={`p-3 rounded border text-sm max-w-[90%] ${msg.role === 'user' ? 'bg-secondary/10 border-secondary/30 text-on-surface' : 'bg-surface-container border-outline-variant/50'}`}>
            {msg.role === 'assistant' ? (
              <div className="markdown-body">
                 <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
            
            {msg.type === 'options' && options.length > 0 && !selectedOptionId && (
              <div className="flex flex-col gap-2 mt-4">
                {options.map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => {
                      setSelectedOptionId(opt.id);
                      // trigger validation via a global event or in the parent component
                      window.dispatchEvent(new CustomEvent('SELECT_OPTION', { detail: opt }));
                    }}
                    className="p-3 border border-outline-variant rounded hover:border-secondary hover:bg-secondary/5 transition-colors text-left"
                  >
                    <div className="font-bold text-on-surface">{opt.label}</div>
                    <div className="text-xs text-on-surface-variant mt-1">{opt.summary}</div>
                  </button>
                ))}
              </div>
            )}

            {msg.type === 'options' && selectedOptionId && (
               <div className="mt-2 text-xs text-secondary border-t border-outline-variant/50 pt-2">
                 Option Selected: {options.find(o => o.id === selectedOptionId)?.label}
               </div>
            )}
            
            {msg.type === 'validation' && validation && (
              <div className="mt-4 flex flex-col gap-2">
                 {validation.conflicts.map((c, idx) => (
                   <div key={idx} className="flex gap-2 text-error bg-error/10 p-2 rounded items-start text-xs">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span>{c}</span>
                   </div>
                 ))}
                 {validation.warnings.map((w, idx) => (
                   <div key={idx} className="flex gap-2 text-tertiary bg-tertiary/10 p-2 rounded items-start text-xs">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{w}</span>
                   </div>
                 ))}
                 {!approved && (
                   <div className="flex flex-col gap-2 mt-2">
                     {(validation.warnings.length > 0 || validation.conflicts.length > 0) && (
                       <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={acknowledged} 
                           onChange={(e) => setAcknowledged(e.target.checked)} 
                           className="rounded border-outline-variant text-secondary focus:ring-secondary"
                         />
                         I acknowledge the warnings and conflicts
                       </label>
                     )}
                     <button 
                      disabled={(validation.warnings.length > 0 || validation.conflicts.length > 0) && !acknowledged}
                      onClick={() => {
                         setApproved(true);
                         window.dispatchEvent(new CustomEvent('APPROVE_PLAN'));
                      }}
                      className="bg-secondary text-on-secondary px-3 py-1.5 rounded text-xs font-bold hover:bg-secondary-fixed transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       Approve Architecture
                     </button>
                   </div>
                 )}
                 {approved && (
                   <div className="flex gap-1 items-center text-secondary text-xs mt-2">
                     <CheckCircle2 size={14} /> Approved
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
