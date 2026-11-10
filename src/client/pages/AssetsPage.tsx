import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  FileAudio,
  FileVideo,
  FolderOpen,
  Image as ImageIcon,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type {
  Asset,
  AssetKind,
  AssetScope,
  Character,
  Scene,
  ScriptSummary,
} from '../../shared/types';
import { api } from '../api';
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '../components/Shared';
import { useToast } from '../components/Toast';
import { assetKindLabel, formatBytes } from '../utils';

const kindsByScope: Record<AssetScope, Array<{ value: AssetKind; label: string }>> = {
  script: [
    { value: 'bgm', label: '背景音乐' },
    { value: 'end_card', label: '统一片尾' },
    { value: 'voice', label: '整段配音' },
    { value: 'other', label: '其他素材' },
  ],
  scene: [
    { value: 'scene_image', label: '分镜图片' },
    { value: 'scene_video', label: '视频片段' },
    { value: 'voice', label: '人物配音' },
    { value: 'other', label: '其他素材' },
  ],
  character: [
    { value: 'character_reference', label: '人物参考图' },
    { value: 'other', label: '其他素材' },
  ],
};

export function AssetsPage() {
  const { notify } = useToast();
  const [scripts, setScripts] = useState<ScriptSummary[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scopeType, setScopeType] = useState<AssetScope>('scene');
  const [scopeId, setScopeId] = useState('');
  const [kind, setKind] = useState<AssetKind>('scene_image');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadBase = async () => {
    setLoading(true);
    setError('');
    try {
      const [scriptResult, characterResult] = await Promise.all([
        api.scripts(),
        api.characters(),
      ]);
      setScripts(scriptResult.scripts);
      setCharacters(characterResult.characters);
      setSelectedScriptId((current) => current || scriptResult.scripts[0]?.id || '');
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (!selectedScriptId) {
      setScenes([]);
      return;
    }
    api
      .script(selectedScriptId)
      .then(({ script }) => setScenes(script.scenes))
      .catch((nextError: Error) => notify(nextError.message, 'error'));
  }, [selectedScriptId, notify]);

  const reloadAssets = () => {
    api
      .assets(selectedScriptId || undefined)
      .then(({ assets: items }) => setAssets(items))
      .catch((nextError: Error) => setError(nextError.message));
  };

  useEffect(() => {
    reloadAssets();
  }, [selectedScriptId]);

  useEffect(() => {
    setKind(kindsByScope[scopeType][0].value);
    setScopeId(
      scopeType === 'script'
        ? selectedScriptId
        : scopeType === 'scene'
          ? scenes[0]?.id || ''
          : characters[0]?.id || '',
    );
  }, [scopeType, selectedScriptId, scenes, characters]);

  const scopeOptions = useMemo(() => {
    if (scopeType === 'script') {
      return scripts.map((script) => ({ id: script.id, name: script.title }));
    }
    if (scopeType === 'scene') {
      return scenes.map((scene) => ({
        id: scene.id,
        name: `镜头 ${String(scene.orderIndex + 1).padStart(2, '0')} · ${
          scene.location || scene.visualDescription.slice(0, 20) || '未命名场景'
        }`,
      }));
    }
    return characters.map((character) => ({ id: character.id, name: character.name }));
  }, [scopeType, scripts, scenes, characters]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !scopeId) {
      notify('请选择文件以及关联位置', 'error');
      return;
    }
    setUploading(true);
    try {
      await api.uploadAsset({
        file,
        scopeType,
        scopeId,
        kind,
        role: kind,
      });
      setFile(null);
      const input = document.getElementById('library-file') as HTMLInputElement | null;
      if (input) input.value = '';
      notify('素材已上传并关联');
      reloadAssets();
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function deleteAsset(asset: Asset) {
    if (!window.confirm(`删除素材“${asset.originalName}”？文件会从本地素材目录移除。`)) return;
    try {
      await api.deleteAsset(asset.id);
      notify('素材已删除');
      reloadAssets();
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  function scopeName(asset: Asset) {
    const link = asset.links[0];
    if (!link) return '未关联';
    if (link.scopeType === 'script') {
      return scripts.find((script) => script.id === link.scopeId)?.title ?? '剧本';
    }
    if (link.scopeType === 'scene') {
      const index = scenes.findIndex((scene) => scene.id === link.scopeId);
      return index >= 0 ? `镜头 ${String(index + 1).padStart(2, '0')}` : '镜头';
    }
    return characters.find((character) => character.id === link.scopeId)?.name ?? '人物';
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="素材库"
        title="把画面、声音放到正确的位置"
        description="先选剧本，再上传到剧本、镜头或人物。每个文件都会记录本地路径和关联关系。"
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} retry={loadBase} />}
      {!loading && !error && (
        <>
          <section className="panel upload-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">上传素材</p>
                <h2>新增一个文件</h2>
              </div>
              <UploadCloud size={24} />
            </div>
            <form className="upload-form" onSubmit={upload}>
              <label className="field">
                <span>所属剧本</span>
                <select
                  value={selectedScriptId}
                  onChange={(event) => setSelectedScriptId(event.target.value)}
                >
                  <option value="">不限定剧本</option>
                  {scripts.map((script) => (
                    <option value={script.id} key={script.id}>
                      {script.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>关联位置</span>
                <select
                  value={scopeType}
                  onChange={(event) => setScopeType(event.target.value as AssetScope)}
                >
                  <option value="scene">关联到镜头</option>
                  <option value="script">关联到整个剧本</option>
                  <option value="character">关联到固定人物</option>
                </select>
              </label>
              <label className="field">
                <span>具体对象</span>
                <select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                  <option value="">请选择</option>
                  {scopeOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>素材类型</span>
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as AssetKind)}
                >
                  {kindsByScope[scopeType].map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field-file">
                <span>选择文件</span>
                <input
                  id="library-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button className="button button-primary upload-button" type="submit" disabled={uploading}>
                <UploadCloud size={17} />
                {uploading ? '上传并校验中…' : '上传并关联'}
              </button>
            </form>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">已关联素材</p>
                <h2>{selectedScriptId ? '当前剧本的素材' : '全部素材'}</h2>
              </div>
              <span className="muted">{assets.length} 个文件</span>
            </div>
            {assets.length === 0 ? (
              <EmptyState
                icon={<FolderOpen size={28} />}
                title="素材库还是空的"
                description="上传 AI 生成的人物图、场景图、视频片段或音频，系统会记录它的用途。"
              />
            ) : (
              <div className="asset-grid">
                {assets.map((asset) => (
                  <article className="asset-card" key={asset.id}>
                    <div className="asset-preview">
                      {asset.mimeType.startsWith('image/') ? (
                        <img src={asset.url} alt={asset.originalName} />
                      ) : asset.mimeType.startsWith('video/') ? (
                        <video src={asset.url} muted preload="metadata" />
                      ) : (
                        <div className="audio-preview">
                          <FileAudio size={30} />
                          <audio src={asset.url} controls preload="metadata" />
                        </div>
                      )}
                      <span className="asset-kind">
                        {asset.mimeType.startsWith('video/') ? (
                          <FileVideo size={13} />
                        ) : asset.mimeType.startsWith('image/') ? (
                          <ImageIcon size={13} />
                        ) : (
                          <FileAudio size={13} />
                        )}
                        {assetKindLabel(asset.kind)}
                      </span>
                    </div>
                    <div className="asset-body">
                      <h3 title={asset.originalName}>{asset.originalName}</h3>
                      <p>{scopeName(asset)}</p>
                      <div className="asset-meta">
                        <span>{formatBytes(asset.sizeBytes)}</span>
                        {asset.width && asset.height && (
                          <span>
                            {asset.width}×{asset.height}
                          </span>
                        )}
                        {asset.durationMs && <span>{Math.round(asset.durationMs / 1000)} 秒</span>}
                      </div>
                      <div className="asset-actions">
                        <a className="text-link" href={asset.url} target="_blank" rel="noreferrer">
                          查看文件
                        </a>
                        <button className="text-danger" type="button" onClick={() => deleteAsset(asset)}>
                          <Trash2 size={14} /> 删除
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
