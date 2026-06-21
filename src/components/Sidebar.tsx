import { MessageSquare, Wrench, Plus, Book, LogOut } from 'lucide-react';
import type { NavTab } from '../types';

interface SidebarProps {
  activeNav: NavTab;
  setActiveNav: (nav: NavTab) => void;
}

export default function Sidebar({ activeNav, setActiveNav }: SidebarProps) {
  const navItems = [
    { id: 'assistant', icon: MessageSquare, label: 'Assistant' },
    { id: 'debug', icon: Wrench, label: 'Debug' },
  ] as const;

  return (
    <nav className="bg-surface-container-low border-r border-outline-variant w-[64px] lg:w-[240px] flex flex-col shrink-0 z-40 transition-all duration-200 ease-in-out">
      <div className="flex-1 py-panel-padding flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex items-center gap-md px-panel-padding py-2 mx-sm rounded transition-colors group cursor-pointer ${
                isActive 
                  ? 'bg-surface-container-highest border-l-2 border-secondary text-secondary'
                  : 'border-l-2 border-transparent text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-secondary' : 'group-hover:text-secondary transition-colors'} />
              <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase hidden lg:block">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-panel-padding flex flex-col gap-1 border-t border-outline-variant">
        <button className="flex items-center gap-md px-panel-padding py-2 rounded border border-outline-variant text-on-surface hover:bg-surface-container transition-colors w-full justify-center lg:justify-start">
          <Plus size={20} />
          <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase hidden lg:block">
            New Project
          </span>
        </button>
      </div>

      <div className="py-panel-padding flex flex-col gap-1">
        <button className="flex items-center gap-md px-panel-padding py-2 mx-sm rounded text-on-surface-variant hover:bg-surface-container transition-colors group">
          <Book size={20} className="group-hover:text-secondary transition-colors" />
          <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase hidden lg:block">
            Docs
          </span>
        </button>
        <button className="flex items-center gap-md px-panel-padding py-2 mx-sm rounded text-on-surface-variant hover:bg-surface-container transition-colors group">
          <LogOut size={20} className="group-hover:text-secondary transition-colors" />
          <span className="font-mono text-[11px] font-medium tracking-[0.05em] uppercase hidden lg:block">
            Logout
          </span>
        </button>
      </div>
    </nav>
  );
}
