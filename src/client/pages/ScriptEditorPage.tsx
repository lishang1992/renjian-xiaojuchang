import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  Character,
  DialogueLine,
  ProductionStatus,
  Scene,
  ScriptDetail,
} from '../../shared/types';
import { api } from '../api';
import {
  CopyButton,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SaveState,
  StatusBadge,
} from '../components/Shared';
import { useToast } from '../components/Toast';
import { assetKindLabel, formatBytes, todayShanghai } from '../utils';

interface ScriptForm {
  title: string;
  summary: string;
  narration: string;
  scheduledDate: string;
  dailySlot: number;
  productionStatus: ProductionStatus;
  characterIds: string[];
}

interface DialogueDraft {
  id?: string;
  characterId: string;
  speaker: string;
  text: string;
}

interface SceneForm {
  durationSeconds: number;
  location: string;
  visualDescription: string;
  action: string;
  shotSize: string;
  narration: string;
  imagePrompt: string;
  videoPrompt: string;
  characterIds: string[];
  dialogues: DialogueDraft[];
}

function scriptToForm(script: ScriptDetail): ScriptForm {
  return {
    title: script.title,
    summary: script.summary,
    narration: script.narration,
    scheduledDate: script.scheduledDate ?? '',
    dailySlot: script.dailySlot ?? 1,
    productionStatus: script.productionStatus,
    characterIds: script.characters.map((character) => character.id),
  };
}

function sceneToForm(scene: Scene): SceneForm {
  return {
    durationSeconds: scene.durationSeconds,
    location: scene.location,
    visualDescription: scene.visualDescription,
    action: scene.action,
    shotSize: scene.shotSize,
    narration: scene.narration,
    imagePrompt: scene.imagePrompt,
    videoPrompt: scene.videoPrompt,
    characterIds: scene.characters.map((character) => character.id),
    dialogues: scene.dialogueLines.map((line) => ({
      id: line.id,
      characterId: line.characterId ?? '',
      speaker: line.speaker,
      text: line.text,
    })),
  };
}

function scenePayload(form: SceneForm) {
  return {
    ...form,
    dialogues: form.dialogues.map((dialogue) => ({
      ...dialogue,
      characterId: dialogue.characterId || null,
    })),
  };
}

function newSceneForm(): SceneForm {
  return {
    durationSeconds: 8,
    location: '',
    visualDescription: '',
    action: '',
    shotSize: '中景',
    narration: '',
    imagePrompt: '',
    videoPrompt: '',
    characterIds: [],
    dialogues: [],
  };
}

const shotSizes = ['远景', '全景', '中景', '近景', '特写', '大特写'];

export function ScriptEditorPage() {
  const { scriptId = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [script, setScript] = useState<ScriptDetail | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [form, setForm] = useState<ScriptForm | null>(null);
  const [scriptDirty, setScriptDirty] = useState(false);
  const [savingScript, setSavingScript] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSceneId, setActiveSceneId] = useState('');
  const [sceneForm, setSceneForm] = useState<SceneForm>(newSceneForm());
  const [sceneDirty, setSceneDirty] = useState(false);
  const [savingScene, setSavingScene] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);

  const activeScene = script?.scenes.find((scene) => scene.id === activeSceneId) ?? null;

  const readySceneCount = useMemo(
    () =>
      script?.scenes.filter(
        (scene) =>
          scene.visualDescription.trim() &&
          scene.characters.length > 0 &&
          scene.imagePrompt.trim() &&
          scene.videoPrompt.trim(),
      ).length ?? 0,
    [script],
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ script: nextScript }, { characters: nextCharacters }] = await Promise.all([
        api.script(scriptId),
        api.characters(),
      ]);
      setScript(nextScript);
      setCharacters(nextCharacters);
      setForm(scriptToForm(nextScript));
      setScriptDirty(false);
      const nextActive =
        nextScript.scenes.find((scene) => scene.id === activeSceneId) ?? nextScript.scenes[0];
      if (nextActive) {
        setActiveSceneId(nextActive.id);
        setSceneForm(sceneToForm(nextActive));
      } else {
        setActiveSceneId('');
        setSceneForm(newSceneForm());
      }
      setSceneDirty(false);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [scriptId]);

  function patchScript<K extends keyof ScriptForm>(key: K, value: ScriptForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setScriptDirty(true);
  }

  function patchScene<K extends keyof SceneForm>(key: K, value: SceneForm[K]) {
    setSceneForm((current) => ({ ...current, [key]: value }));
    setSceneDirty(true);
  }

  function toggleCharacter(characterId: string) {
    patchScene(
      'characterIds',
      sceneForm.characterIds.includes(characterId)
        ? sceneForm.characterIds.filter((id) => id !== characterId)
        : [...sceneForm.characterIds, characterId],
    );
  }

  function toggleScriptCharacter(characterId: string) {
    if (!form) return;
    patchScript(
      'characterIds',
      form.characterIds.includes(characterId)
        ? form.characterIds.filter((id) => id !== characterId)
        : [...form.characterIds, characterId],
    );
  }

  async function saveScript() {
    if (!form) return;
    setSavingScript(true);
    try {
      const { script: nextScript } = await api.updateScript(scriptId, {
        ...form,
        scheduledDate: form.scheduledDate || null,
        dailySlot: form.scheduledDate ? form.dailySlot : null,
      });
      setScript(nextScript);
      setForm(scriptToForm(nextScript));
      setScriptDirty(false);
      notify('剧本信息已保存');
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    } finally {
      setSavingScript(false);
    }
  }

  async function togglePublished() {
    if (!script) return;
    try {
      const { script: nextScript } = await api.setPublished(script.id, !script.publishedAt);
      setScript(nextScript);
      notify(nextScript.publishedAt ? '已标记为发布' : '已取消发布标记');
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  async function addScene() {
    try {
      const { scene } = await api.createScene(scriptId, newSceneForm());
      const nextScript = {
        ...script!,
        scenes: [...script!.scenes, scene],
        sceneCount: script!.sceneCount + 1,
      };
      setScript(nextScript);
      setActiveSceneId(scene.id);
      setSceneForm(sceneToForm(scene));
      setSceneDirty(false);
      notify(`镜头 ${String(scene.orderIndex + 1).padStart(2, '0')} 已添加`);
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  function selectScene(scene: Scene) {
    if (scene.id === activeSceneId) return;
    if (sceneDirty && !window.confirm('当前镜头还有未保存的修改，仍要切换吗？')) return;
    setActiveSceneId(scene.id);
    setSceneForm(sceneToForm(scene));
    setSceneDirty(false);
  }

  function updateSceneInScript(nextScene: Scene) {
    setScript((current) => {
      if (!current) return current;
      const scenes = current.scenes
        .map((scene) => (scene.id === nextScene.id ? nextScene : scene))
        .sort((a, b) => a.orderIndex - b.orderIndex);
      return { ...current, scenes };
    });
  }

  async function saveScene() {
    if (!activeScene) return;
    if (!sceneForm.visualDescription.trim()) {
      notify('先用一句话写清楚这个镜头要拍什么', 'error');
      return;
    }
    setSavingScene(true);
    try {
      const { scene } = await api.updateScene(activeScene.id, scenePayload(sceneForm));
      updateSceneInScript(scene);
      setSceneForm(sceneToForm(scene));
      setSceneDirty(false);
      notify('镜头已保存');
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    } finally {
      setSavingScene(false);
    }
  }

  async function generatePrompts() {
    if (!activeScene) return;
    if (!sceneForm.visualDescription.trim()) {
      notify('先填写画面描述，生成效果会更准确', 'error');
      return;
    }
    setGenerating(true);
    try {
      const { scene: savedScene } = await api.updateScene(
        activeScene.id,
        scenePayload(sceneForm),
      );
      const { scene } = await api.generatePrompts(savedScene.id);
      updateSceneInScript(scene);
      setSceneForm(sceneToForm(scene));
      setSceneDirty(false);
      notify('两类提示词已生成，可以继续修改');
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function deleteScene() {
    if (!activeScene || !script) return;
    if (!window.confirm(`删除镜头 ${String(activeScene.orderIndex + 1).padStart(2, '0')}？`)) return;
    try {
      await api.deleteScene(activeScene.id);
      const remaining = script.scenes.filter((scene) => scene.id !== activeScene.id);
      setScript({
        ...script,
        scenes: remaining,
        sceneCount: remaining.length,
      });
      const next = remaining[0] ?? null;
      setActiveSceneId(next?.id ?? '');
      setSceneForm(next ? sceneToForm(next) : newSceneForm());
      setSceneDirty(false);
      notify('镜头已删除');
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  async function moveScene(direction: -1 | 1) {
    if (!script || !activeScene) return;
    const currentIndex = script.scenes.findIndex((scene) => scene.id === activeScene.id);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= script.scenes.length) return;
    const ids = script.scenes.map((scene) => scene.id);
    [ids[currentIndex], ids[nextIndex]] = [ids[nextIndex], ids[currentIndex]];
    try {
      const { script: nextScript } = await api.reorderScenes(scriptId, ids);
      setScript(nextScript);
      const moved = nextScript.scenes.find((scene) => scene.id === activeScene.id);
      if (moved) setSceneForm(sceneToForm(moved));
      notify('镜头顺序已更新');
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  function addDialogue() {
    patchScene('dialogues', [
      ...sceneForm.dialogues,
      { characterId: '', speaker: '', text: '' },
    ]);
  }

  function updateDialogue(index: number, patch: Partial<DialogueDraft>) {
    patchScene(
      'dialogues',
      sceneForm.dialogues.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  function removeDialogue(index: number) {
    patchScene(
      'dialogues',
      sceneForm.dialogues.filter((_, lineIndex) => lineIndex !== index),
    );
  }

  async function uploadSceneAsset(event: ChangeEvent<HTMLInputElement>, kind: 'scene_image' | 'scene_video' | 'voice') {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeScene) return;
    setUploadingKind(kind);
    try {
      const { asset } = await api.uploadAsset({
        file,
        scopeType: 'scene',
        scopeId: activeScene.id,
        kind,
        role: kind,
      });
      setScript((current) => {
        if (!current) return current;
        return {
          ...current,
          scenes: current.scenes.map((scene) =>
            scene.id === activeScene.id ? { ...scene, assets: [asset, ...scene.assets] } : scene,
          ),
        };
      });
      notify(`${assetKindLabel(kind)}已上传`);
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    } finally {
      setUploadingKind(null);
    }
  }

  async function deleteSceneAsset(assetId: string) {
    if (!activeScene || !window.confirm('删除这个镜头素材？')) return;
    try {
      await api.deleteAsset(assetId);
      setScript((current) =>
        current
          ? {
              ...current,
              scenes: current.scenes.map((scene) =>
                scene.id === activeScene.id
                  ? { ...scene, assets: scene.assets.filter((asset) => asset.id !== assetId) }
                  : scene,
              ),
            }
          : current,
      );
      notify('素材已删除');
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  async function deleteScript() {
    if (!script || !window.confirm(`删除剧本“${script.title}”？关联的镜头和素材记录也会删除。`)) {
      return;
    }
    try {
      await api.deleteScript(script.id);
      notify('剧本已删除');
      navigate('/scripts');
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  if (loading) {
    return (
      <div className="page">
        <LoadingBlock label="正在打开剧本…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <ErrorBlock message={error} retry={load} />
      </div>
    );
  }
  if (!script || !form) return null;

  const assignedCharacters = characters.filter((character) =>
    form.characterIds.includes(character.id),
  );
  const activeCharacters = characters.filter((character) =>
    sceneForm.characterIds.includes(character.id),
  );

  return (
    <div className="page editor-page">
      <div className="editor-topbar">
        <Link className="back-link" to="/scripts">
          <ArrowLeft size={17} /> 返回剧本列表
        </Link>
        <div className="editor-actions">
          <SaveState saved={!scriptDirty} />
          <button
            type="button"
            className="button button-ghost"
            onClick={togglePublished}
          >
            <Send size={16} />
            {script.publishedAt ? '取消发布标记' : '标记已发布'}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={saveScript}
            disabled={savingScript}
          >
            {savingScript ? '保存中…' : '保存剧本信息'}
          </button>
        </div>
      </div>

      <section className="script-heading-card">
        <div className="script-heading-input">
          <input
            className="title-input"
            value={form.title}
            onChange={(event) => patchScript('title', event.target.value)}
            aria-label="剧本标题"
          />
          <div className="script-badges">
            <StatusBadge status={form.productionStatus} published={Boolean(script.publishedAt)} />
            <span>{script.scenes.length}/8 个镜头</span>
            <span>{readySceneCount} 个镜头信息完整</span>
          </div>
        </div>
        <button className="text-danger script-delete" type="button" onClick={deleteScript}>
          <Trash2 size={15} /> 删除剧本
        </button>
      </section>

      <section className="panel script-info-panel">
        <div className="form-grid">
          <label className="field field-span-2">
            <span>故事简介</span>
            <textarea
              rows={3}
              value={form.summary}
              onChange={(event) => patchScript('summary', event.target.value)}
              placeholder="人物是谁，遇到什么冲突，最后怎样反转？"
            />
          </label>
          <label className="field field-span-2">
            <span>故事旁白</span>
            <textarea
              rows={2}
              value={form.narration}
              onChange={(event) => patchScript('narration', event.target.value)}
              placeholder="需要时填写整体旁白；镜头内的旁白在分镜里填写。"
            />
          </label>
          <label className="field">
            <span>计划日期</span>
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(event) => patchScript('scheduledDate', event.target.value)}
            />
          </label>
          <label className="field">
            <span>当天条次</span>
            <select
              value={form.dailySlot}
              disabled={!form.scheduledDate}
              onChange={(event) => patchScript('dailySlot', Number(event.target.value))}
            >
              <option value={1}>第 1 条</option>
              <option value={2}>第 2 条</option>
              <option value={3}>第 3 条</option>
            </select>
          </label>
          <label className="field">
            <span>制作状态</span>
            <select
              value={form.productionStatus}
              onChange={(event) =>
                patchScript('productionStatus', event.target.value as ProductionStatus)
              }
            >
              <option value="draft">编写中</option>
              <option value="ready">待制作</option>
              <option value="produced">已制作</option>
            </select>
          </label>
          <div className="field">
            <span>快速安排</span>
            <button
              type="button"
              className="button button-ghost button-full"
              onClick={() => patchScript('scheduledDate', todayShanghai())}
            >
              安排到今天
            </button>
          </div>
        </div>

        <div className="cast-picker">
          <div className="field-label-row">
            <span>本剧出场人物</span>
            <Link className="text-link" to="/characters">
              <UsersRound size={15} /> 管理人物
            </Link>
          </div>
          {characters.length === 0 ? (
            <p className="muted">还没有固定人物，先去创建人物档案。</p>
          ) : (
            <div className="chip-row">
              {characters.map((character) => {
                const active = form.characterIds.includes(character.id);
                return (
                  <button
                    type="button"
                    className={`character-chip ${active ? 'active' : ''}`}
                    key={character.id}
                    onClick={() => toggleScriptCharacter(character.id)}
                  >
                    {character.references[0] ? (
                      <img src={character.references[0].url} alt="" />
                    ) : (
                      <span>{character.name.slice(0, 1)}</span>
                    )}
                    {character.name}
                    {active && <CheckCircle2 size={15} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="storyboard-heading">
        <div>
          <p className="eyebrow">分镜工作台</p>
          <h2>把故事拆成能拍的镜头</h2>
        </div>
        <div className="storyboard-actions">
          <span className={script.scenes.length >= 5 ? 'target-met' : 'muted'}>
            {script.scenes.length < 5
              ? `还差 ${5 - script.scenes.length} 个镜头达到完整短剧`
              : `${script.scenes.length} 个镜头`}
          </span>
          <button className="button button-primary" type="button" onClick={addScene}>
            <Plus size={17} /> 添加镜头
          </button>
        </div>
      </div>

      <div className="storyboard-layout">
        <aside className="shot-sidebar">
          <div className="shot-sidebar-header">
            <strong>镜头总览</strong>
            <span>{Math.round(script.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0))} 秒</span>
          </div>
          <div className="shot-list">
            {script.scenes.map((scene, index) => {
              const ready =
                scene.visualDescription &&
                scene.characters.length > 0 &&
                scene.imagePrompt &&
                scene.videoPrompt;
              return (
                <button
                  type="button"
                  key={scene.id}
                  className={`shot-list-item ${scene.id === activeSceneId ? 'active' : ''}`}
                  onClick={() => selectScene(scene)}
                >
                  <span className="shot-number">镜头 {String(index + 1).padStart(2, '0')}</span>
                  {ready && <CheckCircle2 size={14} className="ready-icon" />}
                  <strong>{scene.visualDescription || '等待填写画面描述'}</strong>
                  <span className="shot-people">
                    {scene.characters.map((character) => character.name).join('、') || '人物未选'}
                  </span>
                  <span className="shot-dialogue">
                    {scene.dialogueLines[0]?.text
                      ? `“${scene.dialogueLines[0].text}”`
                      : '暂无对白'}
                  </span>
                  <span className="shot-foot">
                    <span>{scene.durationSeconds} 秒</span>
                    <span>{scene.assets.length} 个素材</span>
                  </span>
                  <ChevronRight size={16} className="shot-chevron" />
                </button>
              );
            })}
          </div>
          {script.scenes.length === 0 && (
            <div className="shot-list-empty">
              <Clapperboard size={24} />
              <p>从第一个镜头开始</p>
              <button className="button button-ghost button-small" type="button" onClick={addScene}>
                添加镜头
              </button>
            </div>
          )}
        </aside>

        {activeScene ? (
          <section className="shot-editor panel">
            <div className="shot-editor-header">
              <div>
                <span className="eyebrow">镜头 {String(activeScene.orderIndex + 1).padStart(2, '0')}</span>
                <h2>{sceneForm.location || '这个镜头发生在哪里？'}</h2>
              </div>
              <div className="shot-toolbar">
                <SaveState saved={!sceneDirty} />
                <button
                  className="icon-button"
                  type="button"
                  title="镜头前移"
                  disabled={activeScene.orderIndex === 0}
                  onClick={() => moveScene(-1)}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="镜头后移"
                  disabled={activeScene.orderIndex === script.scenes.length - 1}
                  onClick={() => moveScene(1)}
                >
                  <ArrowDown size={17} />
                </button>
                <button
                  className="icon-button danger"
                  type="button"
                  title="删除镜头"
                  onClick={deleteScene}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>

            <div className="shot-basic-grid">
              <label className="field">
                <span>场景</span>
                <input
                  value={sceneForm.location}
                  onChange={(event) => patchScene('location', event.target.value)}
                  placeholder="例如：出租屋餐桌旁"
                />
              </label>
              <label className="field">
                <span>景别</span>
                <select
                  value={sceneForm.shotSize}
                  onChange={(event) => patchScene('shotSize', event.target.value)}
                >
                  {shotSizes.map((size) => (
                    <option value={size} key={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>镜头时长（秒）</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={sceneForm.durationSeconds}
                  onChange={(event) =>
                    patchScene('durationSeconds', Number(event.target.value) || 1)
                  }
                />
              </label>
            </div>

            <label className="field shot-main-field">
              <span>镜头画面描述</span>
              <textarea
                rows={4}
                value={sceneForm.visualDescription}
                onChange={(event) => patchScene('visualDescription', event.target.value)}
                placeholder="写清楚观众会看到什么：环境、人物位置、表情、关键物品和情绪。"
              />
            </label>
            <label className="field">
              <span>人物动作</span>
              <textarea
                rows={3}
                value={sceneForm.action}
                onChange={(event) => patchScene('action', event.target.value)}
                placeholder="例如：妈妈把鸡腿夹进儿子碗里，随后把手收回围裙。"
              />
            </label>

            <div className="scene-section">
              <div className="field-label-row">
                <span>
                  <UsersRound size={15} /> 出场人物
                </span>
                <small>从本剧人物中选择</small>
              </div>
              {assignedCharacters.length === 0 ? (
                <p className="inline-hint">先在剧本信息里勾选本剧人物。</p>
              ) : (
                <div className="chip-row">
                  {assignedCharacters.map((character) => {
                    const active = sceneForm.characterIds.includes(character.id);
                    return (
                      <button
                        type="button"
                        className={`character-chip ${active ? 'active' : ''}`}
                        key={character.id}
                        onClick={() => toggleCharacter(character.id)}
                      >
                        {character.references[0] ? (
                          <img src={character.references[0].url} alt="" />
                        ) : (
                          <span>{character.name.slice(0, 1)}</span>
                        )}
                        {character.name}
                        {active && <CheckCircle2 size={15} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="scene-section">
              <div className="field-label-row">
                <span>
                  <MessageSquareText size={15} /> 人物对白
                </span>
                <button className="button button-ghost button-small" type="button" onClick={addDialogue}>
                  <Plus size={14} /> 添加一句
                </button>
              </div>
              {sceneForm.dialogues.length === 0 ? (
                <p className="inline-hint">这个镜头暂时没有对白，可以只保留动作和旁白。</p>
              ) : (
                <div className="dialogue-list">
                  {sceneForm.dialogues.map((dialogue, index) => (
                    <div className="dialogue-editor" key={dialogue.id ?? `new-${index}`}>
                      <select
                        aria-label="说话人物"
                        value={dialogue.characterId}
                        onChange={(event) => {
                          const characterId = event.target.value;
                          const character = characters.find((item) => item.id === characterId);
                          updateDialogue(index, {
                            characterId,
                            speaker: character?.name ?? '',
                          });
                        }}
                      >
                        <option value="">旁白 / 未指定</option>
                        {assignedCharacters.map((character) => (
                          <option value={character.id} key={character.id}>
                            {character.name}
                          </option>
                        ))}
                      </select>
                      <textarea
                        aria-label="对白内容"
                        rows={2}
                        value={dialogue.text}
                        onChange={(event) => updateDialogue(index, { text: event.target.value })}
                        placeholder="写一句人物真的会说的话。"
                      />
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label="删除这句对白"
                        onClick={() => removeDialogue(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="field">
              <span>镜头旁白</span>
              <textarea
                rows={2}
                value={sceneForm.narration}
                onChange={(event) => patchScene('narration', event.target.value)}
                placeholder="可选。用于补充画面无法直接传达的信息。"
              />
            </label>

            <div className="prompt-heading">
              <div>
                <p className="eyebrow">AI 生成素材提示词</p>
                <h3>把文字准备成外部工具能用的描述</h3>
              </div>
              <button
                className="button button-accent"
                type="button"
                onClick={generatePrompts}
                disabled={generating}
              >
                <WandSparkles size={17} />
                {generating ? '正在生成…' : '一键生成两类提示词'}
              </button>
            </div>
            <p className="prompt-disclaimer">
              这里的“生成”是基于人物设定和镜头信息拼接本地模板，不会连接外部 AI，也不会自动产生图片。
            </p>

            <div className="prompt-grid">
              <article className="prompt-card">
                <div className="prompt-card-header">
                  <span>
                    <ImageIcon size={17} /> 图片生成提示词
                  </span>
                  <CopyButton text={sceneForm.imagePrompt} label="复制" />
                </div>
                <textarea
                  value={sceneForm.imagePrompt}
                  onChange={(event) => patchScene('imagePrompt', event.target.value)}
                  placeholder="点击上方按钮生成，也可以直接写。"
                  rows={9}
                />
              </article>
              <article className="prompt-card">
                <div className="prompt-card-header">
                  <span>
                    <Sparkles size={17} /> 图片转视频提示词
                  </span>
                  <CopyButton text={sceneForm.videoPrompt} label="复制" />
                </div>
                <textarea
                  value={sceneForm.videoPrompt}
                  onChange={(event) => patchScene('videoPrompt', event.target.value)}
                  placeholder="描述动作过程、表情变化和镜头运动。"
                  rows={9}
                />
              </article>
            </div>

            <div className="scene-section materials-section">
              <div className="field-label-row">
                <span>
                  <UploadCloud size={15} /> 对应素材
                </span>
                <small>文件保存在本机素材目录</small>
              </div>
              <div className="asset-upload-actions">
                <label className="upload-tile">
                  <ImageIcon size={18} />
                  <span>{uploadingKind === 'scene_image' ? '上传中…' : '上传分镜图片'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={Boolean(uploadingKind)}
                    onChange={(event) => uploadSceneAsset(event, 'scene_image')}
                  />
                </label>
                <label className="upload-tile">
                  <FileVideo size={18} />
                  <span>{uploadingKind === 'scene_video' ? '上传中…' : '上传视频片段'}</span>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    disabled={Boolean(uploadingKind)}
                    onChange={(event) => uploadSceneAsset(event, 'scene_video')}
                  />
                </label>
                <label className="upload-tile">
                  <FileAudio size={18} />
                  <span>{uploadingKind === 'voice' ? '上传中…' : '上传人物配音'}</span>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg"
                    disabled={Boolean(uploadingKind)}
                    onChange={(event) => uploadSceneAsset(event, 'voice')}
                  />
                </label>
              </div>
              {activeScene.assets.length > 0 ? (
                <div className="shot-assets">
                  {activeScene.assets.map((asset) => (
                    <div className="shot-asset" key={asset.id}>
                      {asset.mimeType.startsWith('image/') ? (
                        <img src={asset.url} alt={asset.originalName} />
                      ) : (
                        <div className="shot-asset-icon">
                          {asset.mimeType.startsWith('video/') ? (
                            <FileVideo size={22} />
                          ) : (
                            <FileAudio size={22} />
                          )}
                        </div>
                      )}
                      <div>
                        <strong>{asset.originalName}</strong>
                        <span>
                          {assetKindLabel(asset.kind)} · {formatBytes(asset.sizeBytes)}
                        </span>
                      </div>
                      <a href={asset.url} target="_blank" rel="noreferrer" className="text-link">
                        查看
                      </a>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label="删除素材"
                        onClick={() => deleteSceneAsset(asset.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="inline-hint">还没有为这个镜头关联素材。可以上传图片、视频或配音。</p>
              )}
            </div>

            <div className="shot-save-bar">
              <div>
                <strong>{sceneForm.durationSeconds} 秒</strong>
                <span>
                  {activeCharacters.length
                    ? `出场：${activeCharacters.map((character) => character.name).join('、')}`
                    : '还没有选择出场人物'}
                </span>
              </div>
              <button
                className="button button-primary"
                type="button"
                onClick={saveScene}
                disabled={savingScene}
              >
                {savingScene ? '保存中…' : '保存这个镜头'}
              </button>
            </div>
          </section>
        ) : (
          <EmptyState
            icon={<Clapperboard size={28} />}
            title="还没有镜头"
            description="建议先拆成 5～8 个镜头，每个镜头只讲清一个动作或情绪变化。"
            action={
              <button className="button button-primary" type="button" onClick={addScene}>
                <Plus size={17} /> 添加第一个镜头
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
