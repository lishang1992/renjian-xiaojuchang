import type {
  Asset,
  AssetKind,
  AssetScope,
  Character,
  DashboardData,
  PromptGenerationResult,
  Scene,
  ScriptDetail,
  ScriptSummary,
} from '../shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let message = `操作失败（${response.status}）`;
    let code: string | undefined;
    try {
      const payload = (await response.json()) as {
        error?: { message?: string; code?: string };
      };
      message = payload.error?.message ?? message;
      code = payload.error?.code;
    } catch {
      // Keep the HTTP fallback when the server returns an empty body.
    }
    throw new ApiError(message, response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<DashboardData>('/api/dashboard'),
  scripts: () => request<{ scripts: ScriptSummary[] }>('/api/scripts'),
  script: (id: string) => request<{ script: ScriptDetail }>(`/api/scripts/${id}`),
  createScript: (body: object) =>
    request<{ script: ScriptSummary }>('/api/scripts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateScript: (id: string, body: object) =>
    request<{ script: ScriptDetail }>(`/api/scripts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  setPublished: (id: string, published: boolean) =>
    request<{ script: ScriptDetail }>(`/api/scripts/${id}/published`, {
      method: 'PUT',
      body: JSON.stringify({ published }),
    }),
  deleteScript: (id: string) =>
    request<void>(`/api/scripts/${id}`, { method: 'DELETE' }),
  characters: () => request<{ characters: Character[] }>('/api/characters'),
  createCharacter: (body: object) =>
    request<{ character: Character }>('/api/characters', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCharacter: (id: string, body: object) =>
    request<{ character: Character }>(`/api/characters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteCharacter: (id: string) =>
    request<void>(`/api/characters/${id}`, { method: 'DELETE' }),
  createScene: (scriptId: string, body: object = {}) =>
    request<{ scene: Scene }>(`/api/scripts/${scriptId}/scenes`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateScene: (id: string, body: object) =>
    request<{ scene: Scene }>(`/api/scenes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteScene: (id: string) =>
    request<void>(`/api/scenes/${id}`, { method: 'DELETE' }),
  generatePrompts: (id: string) =>
    request<PromptGenerationResult & { scene: Scene }>(
      `/api/scenes/${id}/generate-prompts`,
      { method: 'POST' },
    ),
  reorderScenes: (scriptId: string, sceneIds: string[]) =>
    request<{ script: ScriptDetail }>(`/api/scripts/${scriptId}/scenes/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ sceneIds }),
    }),
  assets: (scriptId?: string) =>
    request<{ assets: Asset[] }>(
      `/api/assets${scriptId ? `?scriptId=${encodeURIComponent(scriptId)}` : ''}`,
    ),
  uploadAsset: async (options: {
    file: File;
    scopeType: AssetScope;
    scopeId: string;
    kind: AssetKind;
    role?: string;
  }) => {
    const form = new FormData();
    form.set('file', options.file);
    const query = new URLSearchParams({
      scopeType: options.scopeType,
      scopeId: options.scopeId,
      kind: options.kind,
      role: options.role ?? 'attachment',
    });
    return request<{ asset: Asset }>(`/api/assets/upload?${query}`, {
      method: 'POST',
      body: form,
    });
  },
  deleteAsset: (id: string) =>
    request<void>(`/api/assets/${id}`, { method: 'DELETE' }),
};
