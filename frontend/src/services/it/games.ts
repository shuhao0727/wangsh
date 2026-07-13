/** 游戏资源库 — API 服务 */

import api from "../api";

// ── 类型 ──────────────────────────────────────────────

export interface GameResource {
  id: number;
  title: string;
  description: string | null;
  category: string;
  filename: string;
  file_size: number;
  file_mime: string;
  file_sha256: string | null;
  icon_url: string | null;
  download_count: number;
  is_active: boolean;
  uploaded_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GameListResponse {
  items: GameResource[];
  total: number;
}

export interface GameDownloadLog {
  id: number;
  game_id: number;
  user_id: number | null;
  ip_address: string;
  user_agent: string | null;
  downloaded_at: string | null;
}

export interface PaginatedLogs {
  items: GameDownloadLog[];
  total: number;
}

// ── 公开 API ──────────────────────────────────────────

export const gamesApi = {
  /** 游戏列表（无需登录） */
  list: (params?: {
    category?: string;
    search?: string;
    page?: number;
    size?: number;
  }) =>
    api.get<GameListResponse>("/it/games", { params }).then(
      (r) => r.data as unknown as GameListResponse,
    ),

  /** 分类列表 */
  categories: () =>
    api.get<{ categories: string[] }>("/it/games/categories").then((r) => r.data as unknown as { categories: string[] }),

  /** 游戏详情 */
  get: (id: number) =>
    api.get<GameResource>(`/it/games/${id}`).then((r) => r.data as unknown as GameResource),

  /** 下载游戏文件（需登录，返回相对路径，由 axios 实例自动拼接 baseURL） */
  getDownloadUrl: (id: number) => `/it/games/${id}/download`,
};

// ── 管理员 API ────────────────────────────────────────

export const gamesAdminApi = {
  /** 管理员列表：返回全部游戏（含已下架） */
  list: (params?: {
    category?: string;
    search?: string;
    page?: number;
    size?: number;
  }) =>
    api.get<GameListResponse>("/admin/it/games", { params }).then(
      (r) => r.data as unknown as GameListResponse,
    ),

  /** 上传游戏 */
  create: (data: FormData) =>
    api.post<GameResource>("/admin/it/games", data, {
      headers: { "Content-Type": undefined as unknown as string },
    }).then((r) => r.data as unknown as GameResource),

  /** 编辑游戏 */
  update: (id: number, data: {
    title?: string;
    description?: string;
    category?: string;
    icon_url?: string;
    is_active?: boolean;
  }) =>
    api.put<GameResource>(`/admin/it/games/${id}`, data).then((r) => r.data as unknown as GameResource),

  /** 删除游戏 */
  delete: (id: number) =>
    api.client.delete(`/admin/it/games/${id}`).then((r) => r.data),

  /** 查看下载记录 */
  logs: (id: number, page = 1, size = 50) =>
    api.get<PaginatedLogs>(`/admin/it/games/${id}/logs`, { params: { page, size } }).then(
      (r) => r.data as unknown as PaginatedLogs,
    ),
};
