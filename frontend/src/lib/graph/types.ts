export type Subject = 'DSA' | 'SQL' | 'DBMS' | 'OS' | 'CN' | 'OOP';

export type MasteryBand = 'weak' | 'developing' | 'strong' | 'unrated';

export type LinkKind = 'prerequisite' | 'related';

export interface Topic {
  id: string;
  label: string;
  subject: Subject;
  prerequisites: string[];
  related: string[];
  description?: string;
}

export interface UserTopicState {
  topicId: string;
  rating: number; // normalized to 0..1 using the slider's own min/max (1..5 in Clarity)
  lastRevisedAt?: string;
  quizMistakes?: number;
}

export interface GraphNode {
  id: string;
  label: string;
  subject: Subject;
  mastery: number | null; // 0..1 or null if unrated
  band: MasteryBand; // weak <0.4 | developing 0.4-0.7 | strong >=0.7 | unrated
  degree: number;
  lastRevisedAt?: string;
  quizMistakes?: number;
  whyItMatters?: string;
  // Simulation / D3 properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  radius?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  kind: LinkKind;
  blocked: boolean; // true when kind is prerequisite AND prerequisite topic is weak AND dependent topic is not
}

export interface GraphMeta {
  targetCompany?: string;
  timeline?: string;
  generatedAt: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  meta: GraphMeta;
}

export interface GraphSettings {
  // Filters
  searchQuery: string;
  selectedSubjects: Subject[];
  selectedBands: MasteryBand[];
  showOrphans: boolean;
  
  // Display
  showArrows: boolean;
  fadeThreshold: number; // 0.4 - 3.0
  nodeSize: number; // 0.5 - 2.5
  linkThickness: number; // 0.5 - 3.0
  
  // Forces
  chargeRepel: number; // -400 to 0 (default: -120)
  linkDistance: number; // 20 to 200 (default: 55)
  linkStrength: number; // 0 to 1.0 (default: 0.6)
  centerStrength: number; // 0 to 0.3 (default: 0.06)
  
  // Mode
  mode: 'global' | 'local';
  localDepth: number; // 1 to 3
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  searchQuery: '',
  selectedSubjects: ['DSA', 'SQL', 'DBMS', 'OS', 'CN', 'OOP'],
  selectedBands: ['weak', 'developing', 'strong', 'unrated'],
  showOrphans: true,
  showArrows: false,
  fadeThreshold: 1.1,
  nodeSize: 1.0,
  linkThickness: 1.0,
  chargeRepel: -120,
  linkDistance: 55,
  linkStrength: 0.6,
  centerStrength: 0.06,
  mode: 'global',
  localDepth: 1,
};
