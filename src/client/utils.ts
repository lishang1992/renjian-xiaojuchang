export function formatDate(date: string | null) {
  if (!date) return '未安排日期';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T12:00:00`));
}

export function todayShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function statusLabel(status: 'draft' | 'ready' | 'produced') {
  return status === 'draft' ? '编写中' : status === 'ready' ? '待制作' : '已制作';
}

export function assetKindLabel(kind: string) {
  const labels: Record<string, string> = {
    character_reference: '人物参考图',
    scene_image: '分镜图片',
    scene_video: '视频片段',
    voice: '人物配音',
    bgm: '背景音乐',
    end_card: '片尾',
    other: '其他素材',
  };
  return labels[kind] ?? '素材';
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
