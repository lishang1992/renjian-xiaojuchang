import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type {
  Asset,
  Character,
  Scene,
  ScriptDetail,
  ScriptSummary,
} from '../src/shared/types';
import { createApp } from '../src/server/app';
import { loadConfig } from '../src/server/config';

const config = loadConfig();
const { app, db } = createApp(config);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${url}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? `请求失败：${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function upload(
  filePath: string,
  scopeType: 'script' | 'character' | 'scene',
  scopeId: string,
  kind: string,
  role: string,
) {
  const form = new FormData();
  const extension = path.extname(filePath);
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
  };
  const file = new Blob([fs.readFileSync(filePath)], {
    type: mimeTypes[extension] ?? 'application/octet-stream',
  });
  form.set('file', file, path.basename(filePath));
  const query = new URLSearchParams({ scopeType, scopeId, kind, role });
  return api<{ asset: Asset }>(`/api/assets/upload?${query}`, {
    method: 'POST',
    body: form,
  });
}

function makeImage(filePath: string, label: string, color: string) {
  const filter = [
    `drawtext=fontfile=${fontPath}`,
    `text='${label.replace(/'/g, '')}'`,
    'fontcolor=white',
    'fontsize=54',
    'x=(w-text_w)/2',
    'y=(h-text_h)/2',
    'line_spacing=18',
  ].join(':');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=1080x1920`,
    '-vf',
    filter,
    '-frames:v',
    '1',
    filePath,
  ]);
}

function makeVideo(filePath: string, imagePath: string) {
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-loop',
    '1',
    '-i',
    imagePath,
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-t',
    '2',
    '-vf',
    'scale=1080:1920,fps=30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    filePath,
  ]);
}

function makeAudio(filePath: string, frequency: number, duration: number, extension: 'm4a' | 'mp3') {
  const codec = extension === 'mp3' ? ['-c:a', 'libmp3lame', '-q:a', '5'] : ['-c:a', 'aac'];
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=${frequency}:sample_rate=48000`,
    '-t',
    String(duration),
    ...codec,
    filePath,
  ]);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'renjian-demo-'));
const fontPath = path.join(tempDir, 'font.ttc');
fs.copyFileSync('/System/Library/Fonts/STHeiti Medium.ttc', fontPath);

try {
  const characterInputs = [
    {
      name: '妈妈',
      age: 52,
      appearance: '普通中年女性，脸颊清瘦，眼角有细纹，眼神温和但习惯躲闪',
      hairstyle: '齐耳短发，鬓角微白',
      outfit: '褪色深红旧毛衣，深色长裤',
      personality: '克制、要强，不习惯接受关心，总把最好的留给儿子',
      voice: '略沙哑的中年女声，语速偏慢，关心说得很轻',
    },
    {
      name: '儿子',
      age: 26,
      appearance: '清瘦年轻人，眉眼略显疲惫，下颌线条清楚',
      hairstyle: '自然短碎发',
      outfit: '深灰通勤外套，白衬衫',
      personality: '外冷内软，工作疲惫时容易不耐烦，却非常在意妈妈',
      voice: '低沉年轻男声，语速偏快，情绪上来时会放轻',
    },
  ];

  const existingCharacters = (await api<{ characters: Character[] }>('/api/characters')).characters;
  const people: Character[] = [];
  for (const input of characterInputs) {
    const existing = existingCharacters.find((character) => character.name === input.name);
    if (existing) {
      const { character } = await api<{ character: Character }>(`/api/characters/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      people.push(character);
    } else {
      const { character } = await api<{ character: Character }>('/api/characters', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      people.push(character);
    }
  }
  const [mother, son] = people;

  const sceneInputs = [
    {
      durationSeconds: 7,
      location: '出租屋门口',
      visualDescription: '夜幕下的狭小出租屋，儿子拎着电脑包推门进来，妈妈从餐桌边起身。',
      action: '妈妈接过儿子的外套，儿子疲惫地低头换鞋。',
      shotSize: '全景',
      narration: '',
      characterIds: [mother.id, son.id],
      dialogues: [{ characterId: son.id, speaker: '儿子', text: '妈，我回来了。' }],
    },
    {
      durationSeconds: 8,
      location: '出租屋餐桌',
      visualDescription: '桌上有两碗清汤面，妈妈把唯一的鸡腿夹进儿子碗里，自己的碗里只有青菜。',
      action: '妈妈动作自然地放下筷子，低头擦桌子，避开儿子的目光。',
      shotSize: '中景',
      narration: '',
      characterIds: [mother.id, son.id],
      dialogues: [{ characterId: mother.id, speaker: '妈妈', text: '你吃，我今天吃过了。' }],
    },
    {
      durationSeconds: 9,
      location: '出租屋餐桌',
      visualDescription: '儿子抬头看妈妈，妈妈笑着摆手，笑意却没有落到眼睛里。',
      action: '儿子放下筷子，妈妈下意识把手缩回桌子下面。',
      shotSize: '近景',
      narration: '',
      characterIds: [mother.id, son.id],
      dialogues: [
        { characterId: son.id, speaker: '儿子', text: '你怎么又不吃？' },
        { characterId: mother.id, speaker: '妈妈', text: '妈不饿，你快吃。' },
      ],
    },
    {
      durationSeconds: 8,
      location: '出租屋冰箱前',
      visualDescription: '儿子打开冰箱，冷光照着他的脸，里面只有半盒剩饭、一袋咸菜和几盒胃药。',
      action: '儿子停住，手指扶着冰箱门，喉咙轻轻动了一下。',
      shotSize: '特写',
      narration: '他忽然想起，妈妈好像从来没有和自己一起吃过晚饭。',
      characterIds: [son.id],
      dialogues: [],
    },
    {
      durationSeconds: 9,
      location: '出租屋餐桌',
      visualDescription: '儿子把鸡腿夹回妈妈碗里，妈妈愣住，过了几秒才慢慢抬头。',
      action: '儿子坐回椅子上，把筷子递到妈妈手边。',
      shotSize: '中近景',
      narration: '',
      characterIds: [mother.id, son.id],
      dialogues: [
        { characterId: son.id, speaker: '儿子', text: '那你陪我吃。' },
        { characterId: mother.id, speaker: '妈妈', text: '……好。' },
      ],
    },
    {
      durationSeconds: 6,
      location: '出租屋窗边',
      visualDescription: '妈妈低头吃面，儿子转过脸擦掉眼角，窗外城市灯光安静地亮着。',
      action: '妈妈吃下一口面，儿子把纸巾攥在手心，轻轻呼出一口气。',
      shotSize: '特写',
      narration: '原来她说自己不饿，只是想把最好的都留给我。',
      characterIds: [mother.id, son.id],
      dialogues: [],
    },
  ];

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const scriptInput = {
    title: '妈妈说她不饿',
    summary: '儿子下班回家，发现妈妈把唯一的鸡腿留给自己，才明白她说了很多年的“我不饿”。',
    narration: '有些谎言，是因为爱得太笨拙。',
    scheduledDate: today,
    dailySlot: 1,
    productionStatus: 'ready',
    characterIds: [mother.id, son.id],
  };
  const existingScripts = (await api<{ scripts: ScriptSummary[] }>('/api/scripts')).scripts;
  const existing = existingScripts.find((script) => script.title === scriptInput.title);
  let script: ScriptDetail;
  if (existing) {
    const result = await api<{ script: ScriptDetail }>(`/api/scripts/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(scriptInput),
    });
    script = result.script;
  } else {
    const created = await api<{ script: ScriptSummary }>('/api/scripts', {
      method: 'POST',
      body: JSON.stringify(scriptInput),
    });
    const result = await api<{ script: ScriptDetail }>(`/api/scripts/${created.script.id}`);
    script = result.script;
  }

  const scenes: Scene[] = [];
  for (const [index, sceneInput] of sceneInputs.entries()) {
    const current = script.scenes[index];
    let scene: Scene;
    if (current) {
      const result = await api<{ scene: Scene }>(`/api/scenes/${current.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...sceneInput, imagePrompt: '', videoPrompt: '' }),
      });
      scene = result.scene;
    } else {
      const result = await api<{ scene: Scene }>(`/api/scripts/${script.id}/scenes`, {
        method: 'POST',
        body: JSON.stringify({ ...sceneInput, imagePrompt: '', videoPrompt: '' }),
      });
      scene = result.scene;
    }
    const generated = await api<{ scene: Scene }>(`/api/scenes/${scene.id}/generate-prompts`, {
      method: 'POST',
      body: '{}',
    });
    scenes.push(generated.scene);
  }

  const refreshedCharacters = (await api<{ characters: Character[] }>('/api/characters')).characters;
  const motherRefreshed = refreshedCharacters.find((character) => character.name === '妈妈')!;
  const sonRefreshed = refreshedCharacters.find((character) => character.name === '儿子')!;
  if (motherRefreshed.references.length === 0) {
    const referencePath = path.join(tempDir, 'mother-reference.png');
    makeImage(referencePath, '妈妈 · 人物参考占位图', '#b86f59');
    await upload(referencePath, 'character', motherRefreshed.id, 'character_reference', 'reference');
  }
  if (sonRefreshed.references.length === 0) {
    const referencePath = path.join(tempDir, 'son-reference.png');
    makeImage(referencePath, '儿子 · 人物参考占位图', '#56645a');
    await upload(referencePath, 'character', sonRefreshed.id, 'character_reference', 'reference');
  }

  const colors = ['#7e6753', '#9d624f', '#69584c', '#45544f', '#936856', '#4e5650'];
  const imagePaths: string[] = [];
  for (const [index, scene] of scenes.entries()) {
    if (!scene.assets.some((asset) => asset.kind === 'scene_image')) {
      const imagePath = path.join(tempDir, `scene-${index + 1}.jpg`);
      makeImage(
        imagePath,
        `镜头 ${String(index + 1).padStart(2, '0')} · ${sceneInputs[index].location} · 测试占位图`,
        colors[index],
      );
      imagePaths.push(imagePath);
      await upload(imagePath, 'scene', scene.id, 'scene_image', 'scene_image');
    } else {
      imagePaths.push('');
    }
  }
  if (!scenes[0].assets.some((asset) => asset.kind === 'scene_video') && imagePaths[0]) {
    const videoPath = path.join(tempDir, 'scene-1.mp4');
    makeVideo(videoPath, imagePaths[0]);
    await upload(videoPath, 'scene', scenes[0].id, 'scene_video', 'scene_video');
  }
  if (!scenes[1].assets.some((asset) => asset.kind === 'voice')) {
    const voicePath = path.join(tempDir, 'mother-voice.m4a');
    makeAudio(voicePath, 440, 2, 'm4a');
    await upload(voicePath, 'scene', scenes[1].id, 'voice', 'voice');
  }
  const scriptAssets = (await api<{ assets: Asset[] }>(`/api/assets?scriptId=${script.id}`)).assets;
  if (!scriptAssets.some((asset) => asset.kind === 'bgm')) {
    const bgmPath = path.join(tempDir, 'bgm.mp3');
    makeAudio(bgmPath, 220, 4, 'mp3');
    await upload(bgmPath, 'script', script.id, 'bgm', 'bgm');
  }

  const final = await api<{ script: ScriptDetail }>(`/api/scripts/${script.id}`);
  console.log(`测试剧本已准备：${final.script.title}`);
  console.log(`剧本 ID：${final.script.id}`);
  console.log(`人物：${final.script.characters.map((character) => character.name).join('、')}`);
  console.log(`镜头：${final.script.scenes.length} 个，共 ${final.script.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0)} 秒`);
  console.log('素材：人物参考图、6 张分镜占位图、视频片段、人物配音、背景音乐');
} finally {
  server.close();
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
