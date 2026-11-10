import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import type { AppConfig } from '../../src/server/config';

describe('第一阶段完整工作流', () => {
  let tempRoot: string;
  let config: AppConfig;
  let context: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'renjian-test-'));
    config = {
      projectRoot: tempRoot,
      databasePath: path.join(tempRoot, 'data', 'app.db'),
      storageRoot: path.join(tempRoot, 'storage'),
      port: 0,
    };
    context = createApp(config);
  });

  afterEach(() => {
    context.db.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('可创建剧本、人物、6 个镜头、提示词，并上传关联素材', async () => {
    await request(context.app).get('/api/health').expect(200, {
      ok: true,
      ffmpegReady: true,
      storage: 'ready',
    });

    const mother = await request(context.app)
      .post('/api/characters')
      .send({
        name: '妈妈',
        age: 52,
        appearance: '普通中年女性，脸颊清瘦，眼神温和但习惯躲闪',
        hairstyle: '齐耳短发，鬓角微白',
        outfit: '褪色深红旧毛衣',
        personality: '克制要强，不习惯接受关心',
        voice: '略沙哑，语速慢，总把关心说得很轻',
      })
      .expect(201);
    const son = await request(context.app)
      .post('/api/characters')
      .send({
        name: '儿子',
        age: 26,
        appearance: '清瘦，眉眼疲惫，穿深色外套',
        hairstyle: '短碎发',
        outfit: '深灰通勤外套',
        personality: '外冷内软，习惯把疲惫藏起来',
        voice: '低沉，语速偏快，情绪上来时反而放轻',
      })
      .expect(201);

    const scriptResponse = await request(context.app)
      .post('/api/scripts')
      .send({
        title: '妈妈说她不饿',
        summary: '儿子下班回家，发现妈妈把唯一的鸡腿留给自己，才明白她说了很多年的“我不饿”。',
        narration: '有些谎言，是因为爱得太笨拙。',
        scheduledDate: '2026-11-05',
        dailySlot: 1,
        productionStatus: 'ready',
        characterIds: [mother.body.character.id, son.body.character.id],
      })
      .expect(201);
    const scriptId = scriptResponse.body.script.id as string;

    await request(context.app)
      .post('/api/scripts')
      .send({
        title: '同日重复条次',
        summary: '',
        narration: '',
        scheduledDate: '2026-11-05',
        dailySlot: 1,
        productionStatus: 'draft',
        characterIds: [],
      })
      .expect(409);

    const sceneInputs = [
      {
        durationSeconds: 7,
        location: '出租屋门口',
        visualDescription: '夜幕下的出租屋，儿子拎着电脑包推门进来，妈妈从餐桌边起身。',
        action: '妈妈接过儿子的外套，儿子疲惫地换鞋。',
        shotSize: '全景',
        narration: '',
        characterIds: [mother.body.character.id, son.body.character.id],
        dialogues: [{ characterId: son.body.character.id, speaker: '儿子', text: '妈，我回来了。' }],
      },
      {
        durationSeconds: 8,
        location: '出租屋餐桌',
        visualDescription: '桌上有两碗面，妈妈把唯一的鸡腿夹进儿子碗里，自己的碗里只有青菜。',
        action: '妈妈动作自然地把鸡腿推远，低头擦桌子。',
        shotSize: '中景',
        narration: '',
        characterIds: [mother.body.character.id, son.body.character.id],
        dialogues: [{ characterId: mother.body.character.id, speaker: '妈妈', text: '你吃，我今天吃过了。' }],
      },
      {
        durationSeconds: 9,
        location: '出租屋餐桌',
        visualDescription: '儿子抬头看妈妈，妈妈笑着摆手，笑意却没有落到眼睛里。',
        action: '儿子放下筷子，妈妈下意识把手缩回桌下。',
        shotSize: '近景',
        narration: '',
        characterIds: [mother.body.character.id, son.body.character.id],
        dialogues: [
          { characterId: son.body.character.id, speaker: '儿子', text: '你怎么又不吃？' },
          { characterId: mother.body.character.id, speaker: '妈妈', text: '妈不饿，你快吃。' },
        ],
      },
      {
        durationSeconds: 8,
        location: '出租屋冰箱前',
        visualDescription: '儿子打开冰箱，冷光照着他的脸，里面只有半盒剩饭、一袋咸菜和几盒胃药。',
        action: '儿子停住，手指扶着冰箱门，喉咙轻轻动了一下。',
        shotSize: '特写',
        narration: '他忽然想起，妈妈好像从来没有和自己一起吃过晚饭。',
        characterIds: [son.body.character.id],
        dialogues: [],
      },
      {
        durationSeconds: 9,
        location: '出租屋餐桌',
        visualDescription: '儿子把鸡腿夹回妈妈碗里，妈妈愣住，没有马上抬头。',
        action: '儿子坐回椅子上，把筷子递到妈妈手边。',
        shotSize: '中近景',
        narration: '',
        characterIds: [mother.body.character.id, son.body.character.id],
        dialogues: [
          { characterId: son.body.character.id, speaker: '儿子', text: '那你陪我吃。' },
          { characterId: mother.body.character.id, speaker: '妈妈', text: '……好。' },
        ],
      },
      {
        durationSeconds: 6,
        location: '出租屋窗边',
        visualDescription: '妈妈低头吃面，儿子转过脸擦掉眼角，窗外城市灯光安静地亮着。',
        action: '妈妈吃下一口面，儿子把纸巾攥在手里。',
        shotSize: '特写',
        narration: '原来她说自己不饿，只是想把最好的都留给我。',
        characterIds: [mother.body.character.id, son.body.character.id],
        dialogues: [],
      },
    ];

    const sceneIds: string[] = [];
    for (const sceneInput of sceneInputs) {
      const response = await request(context.app)
        .post(`/api/scripts/${scriptId}/scenes`)
        .send({ ...sceneInput, imagePrompt: '', videoPrompt: '' })
        .expect(201);
      sceneIds.push(response.body.scene.id);
    }

    for (const [index, sceneId] of sceneIds.entries()) {
      const generated = await request(context.app)
        .post(`/api/scenes/${sceneId}/generate-prompts`)
        .expect(200);
      expect(generated.body.imagePrompt).toContain('9:16竖屏');
      expect(generated.body.videoPrompt).toContain(`${sceneInputs[index].durationSeconds}秒`);
      expect(generated.body.imagePrompt).not.toContain('。。');
      expect(generated.body.videoPrompt).not.toContain('。。');
    }

    const detail = await request(context.app).get(`/api/scripts/${scriptId}`).expect(200);
    expect(detail.body.script.scenes).toHaveLength(6);
    expect(detail.body.script.scenes.reduce(
      (sum: number, scene: { durationSeconds: number }) => sum + scene.durationSeconds,
      0,
    )).toBe(47);
    expect(detail.body.script.scenes[2].dialogueLines).toHaveLength(2);
    expect(detail.body.script.characters.map((character: { name: string }) => character.name)).toEqual([
      '妈妈',
      '儿子',
    ]);

    const imagePath = path.join(tempRoot, 'reference.png');
    const videoPath = path.join(tempRoot, 'clip.mp4');
    const audioPath = path.join(tempRoot, 'voice.m4a');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=#c8755b:s=720x960',
      '-frames:v',
      '1',
      imagePath,
    ]);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=#5b6b55:s=108x192:d=1',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-shortest',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      videoPath,
    ]);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=44100',
      '-t',
      '1',
      '-c:a',
      'aac',
      audioPath,
    ]);

    const reference = await request(context.app)
      .post(
        `/api/assets/upload?scopeType=character&scopeId=${mother.body.character.id}&kind=character_reference&role=reference`,
      )
      .attach('file', imagePath)
      .expect(201);
    expect(reference.body.asset.width).toBe(720);
    expect(reference.body.asset.height).toBe(960);
    await request(context.app).get(reference.body.asset.url).expect(200);

    const sceneImage = await request(context.app)
      .post(
        `/api/assets/upload?scopeType=scene&scopeId=${sceneIds[0]}&kind=scene_image&role=scene_image`,
      )
      .attach('file', imagePath)
      .expect(201);
    expect(sceneImage.body.asset.links[0]).toMatchObject({
      scopeType: 'scene',
      scopeId: sceneIds[0],
    });

    const clip = await request(context.app)
      .post(
        `/api/assets/upload?scopeType=scene&scopeId=${sceneIds[0]}&kind=scene_video&role=scene_video`,
      )
      .attach('file', videoPath)
      .expect(201);
    expect(clip.body.asset.durationMs).toBeGreaterThan(0);

    const voice = await request(context.app)
      .post(
        `/api/assets/upload?scopeType=scene&scopeId=${sceneIds[1]}&kind=voice&role=voice`,
      )
      .attach('file', audioPath)
      .expect(201);
    expect(voice.body.asset.mimeType).toMatch(/audio/);

    const assets = await request(context.app)
      .get(`/api/assets?scriptId=${scriptId}`)
      .expect(200);
    expect(assets.body.assets.length).toBeGreaterThanOrEqual(4);

    const finalDetail = await request(context.app).get(`/api/scripts/${scriptId}`).expect(200);
    expect(finalDetail.body.script.scenes[0].assets).toHaveLength(2);
    expect(finalDetail.body.script.scenes[1].assets).toHaveLength(1);
    expect(finalDetail.body.script.scenes[0].imagePrompt).toContain('妈妈');
    expect(finalDetail.body.script.scenes[2].videoPrompt).toContain('9:16竖屏');
  });
});
