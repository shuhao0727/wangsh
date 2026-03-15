import { api } from "../api";

export interface GithubSyncSettings {
  repo_url: string
  repo_owner: string
  repo_name: string
  branch: string
  token_masked: string
  token_configured: boolean
  enabled: boolean
  interval_hours: number
  delete_mode: "unpublish" | "soft_delete"
  last_test_status?: string | null
  last_test_message?: string | null
  last_test_at?: string | null
  updated_at?: string | null
}

export interface GithubSyncRun {
  id: number
  trigger_type: string
  status: string
  repo_owner: string
  repo_name: string
  branch: string
  created_count: number
  updated_count: number
  deleted_count: number
  skipped_count: number
  error_summary?: string | null
  started_at: string
  finished_at?: string | null
  task_id?: string | null
}

export interface GithubSyncTaskStatus {
  task_id: string
  state: string
  ready: boolean
  successful: boolean
  progress_percent: number
  progress_done: number
  progress_total: number
  progress_phase: string
  progress_current: string
  created_paths: string[]
  updated_paths: string[]
  deleted_paths: string[]
  compiled_note_ids: number[]
  compile_failed: Array<{ path?: string; note_id?: number; error?: string }>
  error?: string | null
}

export const githubSyncApi = {
  async getSettings(): Promise<GithubSyncSettings> {
    const res = await api.get("/informatics/sync/github/settings");
    return res.data as unknown as GithubSyncSettings;
  },
  async saveSettings(payload: {
    repo_url: string
    branch: string
    token?: string
    enabled: boolean
    interval_hours: number
    delete_mode: "unpublish" | "soft_delete"
  }): Promise<GithubSyncSettings> {
    const res = await api.put("/informatics/sync/github/settings", payload);
    return res.data as unknown as GithubSyncSettings;
  },
  async testConnection(payload: { repo_url: string; branch: string; token: string }) {
    const res = await api.post("/informatics/sync/github/test-connection", payload);
    return res.data as unknown as { ok: boolean; message: string };
  },
  async trigger(dry_run = false, force_recompile = false): Promise<GithubSyncRun> {
    const res = await api.post("/informatics/sync/github/trigger", { dry_run, force_recompile });
    return res.data as unknown as GithubSyncRun;
  },
  async listRuns(limit = 10): Promise<GithubSyncRun[]> {
    const res = await api.get("/informatics/sync/github/runs", { params: { limit } });
    return res.data as unknown as GithubSyncRun[];
  },
  async getTaskStatus(taskId: string): Promise<GithubSyncTaskStatus> {
    const res = await api.get("/informatics/sync/github/task-status", { params: { task_id: taskId } });
    return res.data as unknown as GithubSyncTaskStatus;
  },
};
