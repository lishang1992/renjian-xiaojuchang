import { z } from 'zod';

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
  .nullable()
  .optional();

export const scriptInputSchema = z.object({
  title: z.string().trim().min(1, '请填写剧本标题').max(100),
  summary: z.string().trim().max(1000).default(''),
  narration: z.string().trim().max(3000).default(''),
  scheduledDate: optionalDate,
  dailySlot: z.number().int().min(1).max(3).nullable().optional(),
  productionStatus: z.enum(['draft', 'ready', 'produced']).default('draft'),
  characterIds: z.array(z.string().uuid()).default([]),
});

export const characterInputSchema = z.object({
  name: z.string().trim().min(1, '请填写人物名称').max(50),
  age: z.number().int().min(1).max(120).nullable().optional(),
  appearance: z.string().trim().max(1500).default(''),
  hairstyle: z.string().trim().max(500).default(''),
  outfit: z.string().trim().max(500).default(''),
  personality: z.string().trim().max(1000).default(''),
  voice: z.string().trim().max(1000).default(''),
});

export const dialogueInputSchema = z.object({
  id: z.string().optional(),
  characterId: z.string().uuid().nullable().optional(),
  speaker: z.string().trim().max(100).default(''),
  text: z.string().trim().min(1, '对白不能为空').max(1000),
});

export const sceneInputSchema = z.object({
  durationSeconds: z.number().int().min(1).max(30).default(8),
  location: z.string().trim().max(300).default(''),
  visualDescription: z.string().trim().max(2000).default(''),
  action: z.string().trim().max(2000).default(''),
  shotSize: z.string().trim().max(100).default('中景'),
  narration: z.string().trim().max(1000).default(''),
  imagePrompt: z.string().trim().max(5000).default(''),
  videoPrompt: z.string().trim().max(5000).default(''),
  characterIds: z.array(z.string().uuid()).default([]),
  dialogues: z.array(dialogueInputSchema).default([]),
});

export const scenePatchSchema = sceneInputSchema.partial();

export const assetUploadQuerySchema = z.object({
  scopeType: z.enum(['script', 'character', 'scene']),
  scopeId: z.string().uuid(),
  kind: z.enum([
    'character_reference',
    'scene_image',
    'scene_video',
    'voice',
    'bgm',
    'end_card',
    'other',
  ]),
  role: z.string().trim().min(1).max(80).default('attachment'),
});

export const assetKindForScope: Record<string, string[]> = {
  script: ['bgm', 'end_card', 'voice', 'other'],
  character: ['character_reference', 'other'],
  scene: ['scene_image', 'scene_video', 'voice', 'other'],
};
