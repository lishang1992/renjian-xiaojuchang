import type { CharacterSummary, Scene } from '../../shared/types.js';

interface PromptInput {
  durationSeconds: number;
  location: string;
  visualDescription: string;
  action: string;
  shotSize: string;
  characters: CharacterSummary[];
}

function clean(value: string, fallback: string) {
  return (value.trim() || fallback).replace(/[。；;]+$/u, '');
}

function characterBlock(characters: CharacterSummary[]) {
  if (characters.length === 0) {
    return '画面中不强调具体人物身份';
  }

  return characters
    .map((character) => {
      const age = character.age ? `${character.age}岁` : '';
      const details = [
        age,
        clean(character.appearance, '外貌保持真实自然'),
        character.hairstyle && `发型：${character.hairstyle}`,
        character.outfit && `服装：${character.outfit}`,
        character.personality && `气质：${character.personality}`,
      ]
        .filter(Boolean)
        .join('，');
      return `【${character.name}】${details}`;
    })
    .join('；');
}

export function buildPrompts(input: PromptInput): { imagePrompt: string; videoPrompt: string } {
  const location = clean(input.location, '真实生活场景');
  const shotSize = clean(input.shotSize, '中景');
  const description = clean(input.visualDescription, '人物处于真实生活环境中，情绪自然克制');
  const action = clean(input.action, '人物保持自然细微动作');
  const people = characterBlock(input.characters);

  const imagePrompt = [
    `电影感写实短剧剧照，9:16竖屏构图，${location}，${shotSize}。`,
    `${description}。`,
    `人物设定：${people}。`,
    `动作与表情：${action}。`,
    '自然生活光线，真实皮肤质感，轻微景深，生活化电影调色，避免夸张滤镜和文字水印。',
  ].join('');

  const videoPrompt = [
    `${shotSize}连续镜头，时长${input.durationSeconds}秒，场景：${location}。`,
    `${description}。`,
    `人物：${people}。`,
    `动作过程：${action}。`,
    '情绪表达克制真实，细节动作连贯，人物面部、发型和服装全程保持一致，镜头运动平稳，保持9:16竖屏构图。',
  ].join('');

  return { imagePrompt, videoPrompt };
}

export function getScenePromptContext(scene: Scene): PromptInput {
  return {
    durationSeconds: scene.durationSeconds,
    location: scene.location,
    visualDescription: scene.visualDescription,
    action: scene.action,
    shotSize: scene.shotSize,
    characters: scene.characters,
  };
}
