export type NavTab = 'assistant' | 'logic' | 'hardware' | 'debug';
export type RightTab = 'code' | 'mapping' | 'guide';
export type CenterView = 'schematic' | 'blocks' | 'plan';

export type IntentObject = {
  goal: string;
  components_mentioned: string[];
  missing_info: string[];
  assumptions: string[];
};

export type ArchitectureOption = {
  id: string;
  label: string;
  components: string[];
  tradeoffs: { cost: string; portability: string; complexity: string; power: string };
  summary: string;
};

export type MilestonePlan = {
  milestones: { id: string; title: string; description: string; depends_on: string | null }[];
};

