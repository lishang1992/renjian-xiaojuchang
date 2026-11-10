import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CircleDot, Plus, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { DashboardData } from '../../shared/types';
import { api } from '../api';
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, StatusBadge } from '../components/Shared';
import { formatDate, todayShanghai } from '../utils';

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .dashboard()
      .then((next) => {
        if (active) setData(next);
      })
      .catch((nextError: Error) => {
        if (active) setError(nextError.message);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const today = data?.today ?? todayShanghai();
  const slots = [1, 2, 3].map((slot) => ({
    slot,
    script: data?.todayScripts.find((script) => script.dailySlot === slot),
  }));

  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow={formatDate(today)}
        title="今天，也讲一个真实的故事"
        description="从一句对白开始，把生活里没说完的情绪拍出来。"
        actions={
          <Link className="button button-primary" to="/scripts">
            <Plus size={17} />
            新建剧本
          </Link>
        }
      />

      {error && <ErrorBlock message={error} retry={() => setReloadKey((key) => key + 1)} />}
      {!data && !error && <LoadingBlock />}

      {data && (
        <>
          <section className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">每日三条</p>
                <h2>今天的创作安排</h2>
              </div>
              <span className="muted">{data.todayScripts.length}/3 已安排</span>
            </div>
            <div className="slot-grid">
              {slots.map(({ slot, script }) => (
                <article className={`day-slot ${script ? 'is-filled' : ''}`} key={slot}>
                  <span className="slot-index">第 {slot} 条</span>
                  {script ? (
                    <>
                      <StatusBadge
                        status={script.productionStatus}
                        published={Boolean(script.publishedAt)}
                      />
                      <h3>{script.title}</h3>
                      <p>{script.summary || '还没有写故事简介。'}</p>
                      <div className="slot-meta">
                        <span>{script.sceneCount} 个镜头</span>
                        <span>{script.characters.length} 位人物</span>
                      </div>
                      <Link className="text-link" to={`/scripts/${script.id}`}>
                        继续制作 <ArrowRight size={15} />
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="empty-slot-icon">
                        <CircleDot size={22} />
                      </div>
                      <h3>留一个位置给好故事</h3>
                      <p>安排这一条，或者先写一个临时剧本。</p>
                      <button
                        className="button button-ghost button-small"
                        type="button"
                        onClick={() => navigate(`/scripts?slot=${slot}`)}
                      >
                        开始编写
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="workflow-strip" aria-label="短剧生产流程">
            {[
              '剧本',
              '人物参考图',
              '分镜图片',
              '图生视频',
              '人物配音',
              '字幕',
              '背景音乐',
              '合成导出',
            ].map((item, index) => (
              <div className={index < 4 ? 'workflow-step current' : 'workflow-step'} key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item}</strong>
                {index >= 4 && <small>后续阶段</small>}
              </div>
            ))}
          </section>

          <div className="dashboard-columns">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">继续创作</p>
                  <h2>最近的剧本</h2>
                </div>
                <Link className="text-link" to="/scripts">
                  查看全部 <ArrowRight size={15} />
                </Link>
              </div>
              {data.recentScripts.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays size={24} />}
                  title="还没有剧本"
                  description="先去剧本页写下第一条故事。"
                  action={
                    <Link className="button button-primary" to="/scripts">
                      新建剧本
                    </Link>
                  }
                />
              ) : (
                <div className="recent-list">
                  {data.recentScripts.map((script) => (
                    <Link className="recent-script" key={script.id} to={`/scripts/${script.id}`}>
                      <div className="recent-script-main">
                        <div>
                          <h3>{script.title}</h3>
                          <p>{script.summary || '还没有故事简介。'}</p>
                        </div>
                        <StatusBadge
                          status={script.productionStatus}
                          published={Boolean(script.publishedAt)}
                        />
                      </div>
                      <div className="recent-meta">
                        <span>{formatDate(script.scheduledDate)}</span>
                        <span>{script.sceneCount} 个镜头</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">固定人物</p>
                  <h2>角色档案</h2>
                </div>
                <Link className="text-link" to="/characters">
                  管理人物 <ArrowRight size={15} />
                </Link>
              </div>
              {data.characters.length === 0 ? (
                <EmptyState
                  icon={<UsersRound size={24} />}
                  title="先建立人物档案"
                  description="固定人物形象，后续每个镜头都能复用。"
                  action={
                    <Link className="button button-primary" to="/characters">
                      创建人物
                    </Link>
                  }
                />
              ) : (
                <div className="character-quick-list">
                  {data.characters.slice(0, 5).map((character) => (
                    <Link to="/characters" className="character-quick-item" key={character.id}>
                      {character.references[0] ? (
                        <img src={character.references[0].url} alt="" />
                      ) : (
                        <span className="avatar-placeholder">{character.name.slice(0, 1)}</span>
                      )}
                      <div>
                        <strong>{character.name}</strong>
                        <span>
                          {character.age ? `${character.age} 岁` : '年龄未填写'}
                          {character.personality ? ` · ${character.personality}` : ''}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
