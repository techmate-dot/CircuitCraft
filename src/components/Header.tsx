import { Play, Cpu, Wifi, Settings } from 'lucide-react';
import ProviderSelector from './ProviderSelector';
import brandLogo from '../../assets/circuitcraft_dark_ui_logo.svg';

export default function Header() {
  return (
    <header className="bg-surface border-b border-outline-variant flex justify-between items-center w-full px-panel-padding h-12 z-50 shrink-0">
      <div className="flex items-center">
        <img
          src={brandLogo}
          alt="CircuitCraft"
          className="h-10 w-auto max-w-[220px] object-contain block"
        />
      </div>
      <div className="flex items-center gap-md">
        {/* AI provider selector — shows which general-purpose LLM API is active */}
        <ProviderSelector />
        <button className="bg-secondary text-on-secondary px-md h-[32px] rounded font-mono text-[11px] font-medium tracking-[0.05em] uppercase hover:bg-secondary-fixed transition-colors flex items-center gap-sm">
          <Play size={16} fill="currentColor" />
          Deploy Firmware
        </button>
        <div className="flex items-center gap-sm text-on-surface-variant">
          <button className="p-1 hover:bg-surface-container-highest rounded transition-colors active:scale-95 duration-100 flex items-center justify-center h-[32px] w-[32px]">
            <Cpu size={20} />
          </button>
          <button className="p-1 hover:bg-surface-container-highest rounded transition-colors active:scale-95 duration-100 flex items-center justify-center h-[32px] w-[32px]">
            <Wifi size={20} />
          </button>
          <button className="p-1 hover:bg-surface-container-highest rounded transition-colors active:scale-95 duration-100 flex items-center justify-center h-[32px] w-[32px]">
            <Settings size={20} />
          </button>
          <div className="w-[1px] h-6 bg-outline-variant mx-sm"></div>
          <div className="h-[32px] w-[32px] rounded-full bg-surface-container overflow-hidden border border-outline-variant">
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6CXyZOqEfHwUNGlYj69k_G2lePXjfelVreGsJG3KmU7PiY4bZ6-0_1jFJTlFXp_EOqAMNIgSw-mqmcEnnWNWtNT6C5FoiY9McjE55_u1_HFV6wH6Rn0TIdYV8eL5ForGeex9PQPBwjWPgxfZsfPDbJNXfJjUgutKK1IDLMXss7mJWI1hHvkpBmDIgGWwdArLxp8c9X4MAGIdI-Emk55nvNma3cv4mrKNtVuWj3zaFOOq1R-U8JsFADbwSm5L0YuqEXCU6SpiHxCM"
              alt="User"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
