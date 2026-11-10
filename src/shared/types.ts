export type ProductionStatus = 'draft' | 'ready' | 'produced';

export type AssetKind =
  | 'character_reference'
  | 'scene_image'
  | 'scene_video'
  | 'voice'
  | 'bgm'
  | 'end_card'
  | 'other';

export type AssetScope = 'script' | 'character' | 'scene';

export interface AssetLink {
  scopeType: AssetScope;
  scopeId: string;
  role: string;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: string;
  links: AssetLink[];
}

export interface Character {
  id: string;
  name: string;
  age: number | null;
  appearance: string;
  hairstyle: string;
  outfit: string;
  personality: string;
  voice: string;
  createdAt: string;
  updatedAt: string;
  references: Asset[];
  scriptCount?: number;
}

export interface CharacterSummary {
  id: string;
  name: string;
  age: number | null;
  appearance: string;
  hairstyle: string;
  outfit: string;
  personality: string;
  voice: string;
}

export interface DialogueLine {
  id: string;
  sceneId: string;
  characterId: string | null;
  speaker: string;
  text: string;
  orderIndex: number;
}

export interface Scene {
  id: string;
  scriptId: string;
  orderIndex: number;
  durationSeconds: number;
  location: string;
  visualDescription: string;
  action: string;
  shotSize: string;
  narration: string;
  imagePrompt: string;
  videoPrompt: string;
  characters: CharacterSummary[];
  dialogueLines: DialogueLine[];
  assets: Asset[];
  createdAt: string;
  updatedAt: string;
}

export interface ScriptSummary {
  id: string;
  title: string;
  summary: string;
  narration: string;
  scheduledDate: string | null;
  dailySlot: number | null;
  productionStatus: ProductionStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sceneCount: number;
  characters: CharacterSummary[];
}

export interface ScriptDetail extends ScriptSummary {
  scenes: Scene[];
  assets: Asset[];
}

export interface DashboardData {
  today: string;
  todayScripts: ScriptSummary[];
  recentScripts: ScriptSummary[];
  characters: Character[];
}

export interface PromptGenerationResult {
  imagePrompt: string;
  videoPrompt: string;
}
