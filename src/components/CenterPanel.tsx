import { Undo, Redo, ZoomIn, ZoomOut, MousePointer2, PlusCircle, Activity, Type, Download, Repeat, Wifi } from 'lucide-react';
import type { CenterView } from '../types';
import { useCircuitStore } from '../store';
import ReactFlow, { Background, Controls, EdgeText } from 'reactflow';
import 'reactflow/dist/style.css';

interface CenterPanelProps {
  view: CenterView;
}

export default function CenterPanel({ view }: CenterPanelProps) {
  return (
    <div className="w-[46%] flex flex-col relative min-w-[400px]">
      {/* Floating Action Bar */}
      <div className="absolute top-panel-padding right-panel-padding z-10 flex items-center gap-4">
        <div className="bg-surface border border-outline-variant rounded flex p-1 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
          <button className="p-1 text-on-surface hover:bg-surface-container rounded" title="Undo">
            <Undo size={18} />
          </button>
          <button className="p-1 text-on-surface hover:bg-surface-container rounded" title="Redo">
            <Redo size={18} />
          </button>
          <div className="w-[1px] bg-outline-variant mx-1"></div>
          <button className="p-1 text-on-surface hover:bg-surface-container rounded" title="Zoom In">
            <ZoomIn size={18} />
          </button>
          <button className="p-1 text-on-surface hover:bg-surface-container rounded" title="Zoom Out">
            <ZoomOut size={18} />
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      {view === 'schematic' ? <SchematicCanvas /> : view === 'blocks' ? <BlocksCanvas /> : <PlanCanvas />}
    </div>
  );
}

function SchematicCanvas() {
  return (
    <div className="flex-1 schematic-bg relative overflow-hidden cursor-crosshair w-full h-full">
      <div className="absolute top-4 left-4 bg-surface border border-outline-variant rounded flex flex-col p-1 gap-1 z-10 shadow-lg">
        <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors" title="Select">
          <MousePointer2 size={18} />
        </button>
        <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors" title="Add Component">
          <PlusCircle size={18} />
        </button>
        <button className="p-2 text-secondary bg-surface-container-highest rounded transition-colors" title="Wire Tool">
          <Activity size={18} />
        </button>
        <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors" title="Label">
          <Type size={18} />
        </button>
        <div className="h-[1px] w-full bg-outline-variant my-1"></div>
        <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors" title="Export">
          <Download size={18} />
        </button>
      </div>

      <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern height="24" id="grid" patternUnits="userSpaceOnUse" width="24">
            <rect fill="none" height="24" width="24"></rect>
          </pattern>
        </defs>
        <rect fill="url(#grid)" height="100%" width="100%"></rect>
        
        <g className="cursor-pointer" transform="translate(100, 100)">
          <rect className="schematic-component border-secondary" height="200" width="120" x="0" y="0"></rect>
          <text className="schematic-text font-bold" fill="currentColor" textAnchor="middle" x="60" y="24">ESP32-WROOM</text>
          <text className="schematic-text" textAnchor="middle" x="60" y="40">U1</text>
          
          <g transform="translate(0, 60)">
            <line className="schematic-component" x1="-10" x2="0" y1="0" y2="0"></line>
            <circle className="schematic-pin" cx="-10" cy="0" r="2"></circle>
            <text className="schematic-text" x="8" y="3">3V3</text>
          </g>
          <g transform="translate(0, 84)">
            <line className="schematic-component" x1="-10" x2="0" y1="0" y2="0"></line>
            <circle className="schematic-pin" cx="-10" cy="0" r="2"></circle>
            <text className="schematic-text" x="8" y="3">GND</text>
          </g>
          <g transform="translate(0, 108)">
            <line className="schematic-component" x1="-10" x2="0" y1="0" y2="0"></line>
            <circle className="schematic-pin" cx="-10" cy="0" r="2"></circle>
            <text className="schematic-text" x="8" y="3">IO15</text>
          </g>
          
          <g transform="translate(120, 60)">
            <line className="schematic-component" x1="0" x2="10" y1="0" y2="0"></line>
            <circle className="schematic-pin" cx="10" cy="0" r="2"></circle>
            <text className="schematic-text" textAnchor="end" x="-8" y="3">IO4</text>
          </g>
          <g transform="translate(120, 84)">
            <line className="schematic-component" x1="0" x2="10" y1="0" y2="0"></line>
            <circle className="schematic-pin" cx="10" cy="0" r="2"></circle>
            <text className="schematic-text" textAnchor="end" x="-8" y="3">IO5</text>
          </g>
        </g>
        
        <g transform="translate(400, 120)">
          <rect className="schematic-component" height="60" width="80" x="0" y="0"></rect>
          <text className="schematic-text" textAnchor="middle" x="40" y="24">DHT11</text>
          <text className="schematic-text" textAnchor="middle" x="40" y="40">S1</text>
          <g transform="translate(0, 20)">
            <line className="schematic-component" x1="-10" x2="0" y1="0" y2="0"></line>
            <circle className="schematic-pin" cx="-10" cy="0" r="2"></circle>
            <text className="schematic-text" x="8" y="3">VCC</text>
          </g>
          <g transform="translate(0, 40)">
            <line className="schematic-component" x1="-10" x2="0" y1="0" y2="0"></line>
            <circle className="schematic-pin" cx="-10" cy="0" r="2"></circle>
            <text className="schematic-text" x="8" y="3">DATA</text>
          </g>
        </g>
        
        <g transform="translate(280, 150)">
          <path className="schematic-component" d="M 0 0 L 10 0 L 14 -8 L 22 8 L 30 -8 L 38 8 L 46 -8 L 50 0 L 60 0"></path>
          <text className="schematic-text" textAnchor="middle" x="30" y="-12">R1</text>
          <text className="schematic-text" textAnchor="middle" x="30" y="20">10kΩ</text>
          <circle className="schematic-pin" cx="0" cy="0" r="2"></circle>
          <circle className="schematic-pin" cx="60" cy="0" r="2"></circle>
        </g>
        
        <path className="schematic-wire" d="M 90 160 L 60 160 L 60 40 L 370 40 L 370 140 L 390 140"></path>
        <path className="schematic-wire active-wire" d="M 230 184 L 280 150"></path>
        <path className="schematic-wire" d="M 340 150 L 390 160"></path>
        <circle cx="60" cy="160" fill="var(--color-secondary)" r="3"></circle>
      </svg>
      
      <div className="absolute bottom-4 right-4 bg-surface border border-outline-variant p-2 rounded flex items-center gap-4 text-on-surface-variant font-mono text-[13px] shadow-lg">
        <span>X: 230, Y: 184</span>
        <div className="w-[1px] h-4 bg-outline-variant"></div>
        <span>Grid: 24px</span>
        <div className="w-[1px] h-4 bg-outline-variant"></div>
        <span>100%</span>
      </div>
    </div>
  );
}

function BlocksCanvas() {
  return (
    <div className="flex-1 dot-matrix w-full h-full relative">
      <div className="absolute top-[20%] left-[20%] w-[280px] bg-surface-container-highest border border-outline-variant rounded shadow-xl flex flex-col pt-1 pb-4 px-1 group cursor-grab active:cursor-grabbing">
        <div className="pl-4 pr-2 py-2 flex items-center gap-2">
          <Repeat size={16} className="text-tertiary" />
          <span className="font-mono text-sm text-on-surface">void loop()</span>
        </div>
        
        <div className="pl-6 pr-2">
          <div className="border-l-2 border-tertiary/70 pl-4 py-2 mt-1">
            <div className="bg-surface-container-low border border-outline-variant px-3 py-2 rounded flex items-center justify-between cursor-pointer hover:border-outline-variant/80 transition-colors">
              <span className="font-mono text-[11px] text-on-surface-variant mt-0.5">read distance</span>
              <Wifi size={14} className="text-on-surface-variant opacity-80" />
            </div>
          </div>
          <div className="w-full h-4 border-l-2 border-tertiary/70"></div>
        </div>
      </div>
    </div>
  );
}

function PlanCanvas() {
  const { plan } = useCircuitStore();

  if (!plan) return <div className="flex-1 flex items-center justify-center text-on-surface-variant">No plan available</div>;

  const nodes = plan.milestones.map((m, i) => ({
    id: m.id,
    position: { x: 50, y: 50 + i * 150 },
    data: { 
      label: (
        <div className="flex flex-col gap-1 p-2 w-[240px] text-left">
           <div className="font-bold text-sm tracking-tight">{m.title}</div>
           <div className="text-xs text-on-surface-variant">{m.description}</div>
        </div>
      )
    },
    style: { backgroundColor: 'oklch(var(--color-surface))', borderColor: 'oklch(var(--color-outline-variant))', borderRadius: 8, padding: 0 }
  }));

  const edges = plan.milestones
    .filter(m => m.depends_on)
    .map(m => ({
      id: `e-${m.depends_on}-${m.id}`,
      source: m.depends_on!,
      target: m.id,
      animated: true,
      style: { stroke: 'oklch(var(--color-secondary))' }
    }));

  return (
    <div className="flex-1 w-full h-full schematic-bg relative">
       <ReactFlow nodes={nodes} edges={edges} fitView>
         <Background color="oklch(var(--color-outline-variant))" gap={24} />
         <Controls />
       </ReactFlow>
    </div>
  );
}
