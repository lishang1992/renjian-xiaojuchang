import type { ReactNode } from 'react';
import { AlertTriangle, Check, Copy, LoaderCircle, X } from 'lucide-react';
import type { ProductionStatus } from '../../shared/types';
import { copyText, statusLabel } from '../utils';
import { useToast } from './Toast';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function LoadingBlock({ label = '正在加载…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <LoaderCircle size={22} className="spin" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-block" role="alert">
      <AlertTriangle size={21} />
      <span>{message}</span>
      {retry && (
        <button type="button" className="button button-ghost button-small" onClick={retry}>
          重试
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function StatusBadge({
  status,
  published,
}: {
  status: ProductionStatus;
  published?: boolean;
}) {
  if (published) return <span className="badge badge-published">已发布</span>;
  const tone = status === 'produced' ? 'produced' : status === 'ready' ? 'ready' : 'draft';
  return <span className={`badge badge-${tone}`}>{statusLabel(status)}</span>;
}

export function CopyButton({
  text,
  label = '复制提示词',
}: {
  text: string;
  label?: string;
}) {
  const { notify } = useToast();
  return (
    <button
      type="button"
      className="button button-ghost button-small"
      disabled={!text.trim()}
      onClick={async () => {
        try {
          await copyText(text);
          notify('已复制到剪贴板');
        } catch {
          notify('复制失败，请手动选中文本复制', 'error');
        }
      }}
    >
      <Copy size={15} />
      {label}
    </button>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function SaveState({ saved }: { saved: boolean }) {
  return saved ? (
    <span className="save-state">
      <Check size={14} /> 已保存
    </span>
  ) : (
    <span className="save-state is-dirty">有未保存的修改</span>
  );
}
