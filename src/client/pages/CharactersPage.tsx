import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Pencil, Plus, Trash2, UserRound, UsersRound } from 'lucide-react';
import type { Character } from '../../shared/types';
import { api } from '../api';
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/Shared';
import { useToast } from '../components/Toast';

interface CharacterForm {
  name: string;
  age: string;
  appearance: string;
  hairstyle: string;
  outfit: string;
  personality: string;
  voice: string;
}

const emptyForm: CharacterForm = {
  name: '',
  age: '',
  appearance: '',
  hairstyle: '',
  outfit: '',
  personality: '',
  voice: '',
};

export function CharactersPage() {
  const { notify } = useToast();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Character | 'new' | null>(null);
  const [form, setForm] = useState<CharacterForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = () => {
    setLoading(true);
    setError('');
    api
      .characters()
      .then(({ characters: items }) => setCharacters(items))
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  function openCreate() {
    setForm(emptyForm);
    setEditing('new');
  }

  function openEdit(character: Character) {
    setForm({
      name: character.name,
      age: character.age?.toString() ?? '',
      appearance: character.appearance,
      hairstyle: character.hairstyle,
      outfit: character.outfit,
      personality: character.personality,
      voice: character.voice,
    });
    setEditing(character);
  }

  async function saveCharacter(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
    };
    try {
      if (editing === 'new') {
        await api.createCharacter(payload);
        notify('人物档案已创建');
      } else if (editing) {
        await api.updateCharacter(editing.id, payload);
        notify('人物档案已保存');
      }
      setEditing(null);
      load();
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadReference(character: Character, file: File) {
    setUploadingId(character.id);
    try {
      await api.uploadAsset({
        file,
        scopeType: 'character',
        scopeId: character.id,
        kind: 'character_reference',
        role: 'reference',
      });
      notify('人物参考图已上传并关联');
      load();
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    } finally {
      setUploadingId(null);
      const input = fileInputs.current[character.id];
      if (input) input.value = '';
    }
  }

  async function deleteCharacter(character: Character) {
    if (!window.confirm(`删除“${character.name}”？剧本中的关联会被移除。`)) return;
    try {
      await api.deleteCharacter(character.id);
      notify('人物已删除');
      load();
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  async function deleteReference(assetId: string, character: Character) {
    if (!window.confirm('删除这张人物参考图？')) return;
    try {
      await api.deleteAsset(assetId);
      notify('参考图已删除');
      load();
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="人物管理"
        title="让人物始终是同一张脸"
        description="在这里固定年龄、外貌、服装和声音。制作每个镜头时直接复用，不必反复描述。"
        actions={
          <button className="button button-primary" type="button" onClick={openCreate}>
            <Plus size={17} />
            创建人物
          </button>
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} retry={load} />}
      {!loading && !error && characters.length === 0 && (
        <EmptyState
          icon={<UsersRound size={28} />}
          title="先从人物开始"
          description="创建妈妈、儿子或其他固定角色，再上传一张参考图。"
          action={
            <button className="button button-primary" type="button" onClick={openCreate}>
              创建第一个人物
            </button>
          }
        />
      )}
      {!loading && !error && characters.length > 0 && (
        <div className="character-grid">
          {characters.map((character) => {
            const cover = character.references[0];
            return (
              <article className="character-card" key={character.id}>
                <div className="character-portrait">
                  {cover ? (
                    <img src={cover.url} alt={`${character.name}的人物参考图`} />
                  ) : (
                    <span className="portrait-placeholder">
                      <UserRound size={38} />
                      <small>还没有参考图</small>
                    </span>
                  )}
                  <span className="portrait-badge">
                    {character.age ? `${character.age} 岁` : '年龄未填写'}
                  </span>
                </div>
                <div className="character-body">
                  <div className="character-title-row">
                    <div>
                      <h2>{character.name}</h2>
                      <p>{character.personality || '性格设定待补充'}</p>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`编辑${character.name}`}
                      onClick={() => openEdit(character)}
                    >
                      <Pencil size={17} />
                    </button>
                  </div>
                  <dl className="character-facts">
                    <div>
                      <dt>外貌</dt>
                      <dd>{character.appearance || '待补充'}</dd>
                    </div>
                    <div>
                      <dt>发型 / 服装</dt>
                      <dd>
                        {[character.hairstyle, character.outfit].filter(Boolean).join(' · ') ||
                          '待补充'}
                      </dd>
                    </div>
                    <div>
                      <dt>声音</dt>
                      <dd>{character.voice || '待补充'}</dd>
                    </div>
                  </dl>

                  <div className="reference-strip">
                    {character.references.slice(0, 3).map((asset) => (
                      <div className="reference-thumb" key={asset.id}>
                        <img src={asset.url} alt={`${character.name}参考图`} />
                        <button
                          type="button"
                          aria-label="删除参考图"
                          onClick={() => deleteReference(asset.id, character)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="reference-upload"
                      disabled={uploadingId === character.id}
                      onClick={() => fileInputs.current[character.id]?.click()}
                    >
                      <ImagePlus size={19} />
                      <span>
                        {uploadingId === character.id
                          ? '上传中…'
                          : character.references.length
                            ? '再加一张'
                            : '上传参考图'}
                      </span>
                    </button>
                    <input
                      ref={(element) => {
                        fileInputs.current[character.id] = element;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadReference(character, file);
                      }}
                    />
                  </div>
                  <div className="character-card-footer">
                    <span>用于 {character.scriptCount ?? 0} 个剧本</span>
                    <button
                      className="text-danger"
                      type="button"
                      onClick={() => deleteCharacter(character)}
                    >
                      删除人物
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={editing === 'new' ? '创建固定人物' : `编辑 ${editing.name}`}
          onClose={() => setEditing(null)}
          wide
        >
          <form className="form-grid" onSubmit={saveCharacter}>
            <label className="field">
              <span>人物名称</span>
              <input
                autoFocus
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="例如：妈妈"
              />
            </label>
            <label className="field">
              <span>年龄</span>
              <input
                min={1}
                max={120}
                type="number"
                value={form.age}
                onChange={(event) => setForm({ ...form, age: event.target.value })}
                placeholder="例如：52"
              />
            </label>
            <label className="field field-span-2">
              <span>外貌</span>
              <textarea
                rows={3}
                value={form.appearance}
                onChange={(event) => setForm({ ...form, appearance: event.target.value })}
                placeholder="脸型、眼神、皮肤、体型等后期生成图片时必须保持一致的特征。"
              />
            </label>
            <label className="field">
              <span>发型</span>
              <input
                value={form.hairstyle}
                onChange={(event) => setForm({ ...form, hairstyle: event.target.value })}
                placeholder="例如：齐耳短发，鬓角微白"
              />
            </label>
            <label className="field">
              <span>常穿服装</span>
              <input
                value={form.outfit}
                onChange={(event) => setForm({ ...form, outfit: event.target.value })}
                placeholder="例如：褪色深红旧毛衣"
              />
            </label>
            <label className="field">
              <span>性格与气质</span>
              <textarea
                rows={3}
                value={form.personality}
                onChange={(event) => setForm({ ...form, personality: event.target.value })}
                placeholder="例如：克制、要强，不习惯接受关心"
              />
            </label>
            <label className="field">
              <span>声音设定</span>
              <textarea
                rows={3}
                value={form.voice}
                onChange={(event) => setForm({ ...form, voice: event.target.value })}
                placeholder="音色、语速、口音和说话习惯"
              />
            </label>
            <div className="modal-actions field-span-2">
              <button className="button button-ghost" type="button" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="button button-primary" type="submit" disabled={saving}>
                {saving ? '正在保存…' : '保存人物'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
