import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Clapperboard, Plus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { ScriptSummary } from '../../shared/types';
import { api } from '../api';
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
} from '../components/Shared';
import { useToast } from '../components/Toast';
import { formatDate, todayShanghai } from '../utils';

export function ScriptsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notify } = useToast();
  const [scripts, setScripts] = useState<ScriptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [date, setDate] = useState(todayShanghai());
  const [slot, setSlot] = useState(Number(searchParams.get('slot')) || 1);

  const load = () => {
    setLoading(true);
    setError('');
    api
      .scripts()
      .then(({ scripts: items }) => setScripts(items))
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const { script } = await api.createScript({
        title,
        summary,
        narration: '',
        scheduledDate: date || null,
        dailySlot: date ? slot : null,
        productionStatus: 'draft',
        characterIds: [],
      });
      notify('剧本已创建');
      navigate(`/scripts/${script.id}`);
    } catch (nextError) {
      notify((nextError as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="剧本管理"
        title="先让故事站起来"
        description="一天最多安排三条。先写清楚人物为什么疼，再想反转怎么说。"
        actions={
          <button className="button button-primary" type="button" onClick={() => setShowCreate(true)}>
            <Plus size={17} />
            新建剧本
          </button>
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} retry={load} />}
      {!loading && !error && scripts.length === 0 && (
        <EmptyState
          icon={<Clapperboard size={28} />}
          title="写下第一条人间故事"
          description="一个具体的人、一句没说完的话，通常就是短剧最好的开头。"
          action={
            <button className="button button-primary" type="button" onClick={() => setShowCreate(true)}>
              新建剧本
            </button>
          }
        />
      )}
      {!loading && !error && scripts.length > 0 && (
        <div className="script-grid">
          {scripts.map((script) => (
            <Link className="script-card" key={script.id} to={`/scripts/${script.id}`}>
              <div className="script-card-top">
                <span className="script-number">
                  {script.scheduledDate
                    ? `${formatDate(script.scheduledDate)} · 第 ${script.dailySlot} 条`
                    : '未安排日期'}
                </span>
                <StatusBadge
                  status={script.productionStatus}
                  published={Boolean(script.publishedAt)}
                />
              </div>
              <h2>{script.title}</h2>
              <p>{script.summary || '还没有故事简介。进入后补充人物和分镜。'}</p>
              <div className="script-card-footer">
                <span>{script.sceneCount} 个镜头</span>
                <span>{script.characters.map((character) => character.name).join('、') || '人物待添加'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="新建剧本" onClose={() => setShowCreate(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label className="field field-span-2">
              <span>剧本标题</span>
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：妈妈说她不饿"
                maxLength={100}
                required
              />
            </label>
            <label className="field field-span-2">
              <span>故事简介</span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="一句话说清人物、冲突和反转。"
                rows={4}
              />
            </label>
            <label className="field">
              <span>计划日期</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="field">
              <span>当天第几条</span>
              <select value={slot} onChange={(event) => setSlot(Number(event.target.value))}>
                <option value={1}>第 1 条</option>
                <option value={2}>第 2 条</option>
                <option value={3}>第 3 条</option>
              </select>
            </label>
            <div className="form-note field-span-2">
              <CalendarDays size={17} />
              日期和条次可以稍后修改；同一天同一位置不能放两个剧本。
            </div>
            <div className="modal-actions field-span-2">
              <button className="button button-ghost" type="button" onClick={() => setShowCreate(false)}>
                取消
              </button>
              <button className="button button-primary" type="submit" disabled={saving}>
                {saving ? '正在创建…' : '创建并开始编写'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
