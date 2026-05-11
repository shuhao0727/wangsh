---
status: active
owner: frontend
最近复核: 2026-05-10
---

# Learning Platform Improvement Implementation Plan
> **For agentic workers:** Use subagent-driven-development or executing-plans

**Goal:** Upgrade the ML, AI, and Agents learning pages into a full-stack built-in-plus-extensible learning platform with better interactions and rendering performance.

**Architecture:** Add a lightweight backend content item layer for extensible learning sections while preserving existing progress APIs. On the frontend, introduce shared learning content/progress types and fetch helpers, extract large static page data into module data files, add filters/actions, and render only active/heavy content as needed.

**Tech Stack:** React 19, TypeScript, Vite, existing shadcn-style UI components, FastAPI, SQLAlchemy async, Alembic, PostgreSQL-compatible schema, existing `api` service and `showMessage` toast.

## Task 1: Create shared frontend learning types

Create `frontend/src/pages/Admin/ITTechnology/learning/types.ts` with the following code:

```ts
export type LearningModuleKey = "ml" | "ai" | "agents";

export type LearningSectionKey =
  | "roadmap"
  | "knowledge"
  | "experiments"
  | "tools"
  | "resources"
  | "prompt"
  | "ethics"
  | "frameworks"
  | "core-tech";

export type LearningStageStatus = "pending" | "in-progress" | "completed";

export interface LearningContentItem<TContent = Record<string, unknown>> {
  id?: number;
  module_key: LearningModuleKey;
  section_key: LearningSectionKey;
  item_key: string;
  title: string;
  summary?: string | null;
  content: TContent;
  tags?: string[];
  difficulty?: string | null;
  sort_order?: number;
  enabled?: boolean;
  source_type?: "built-in" | "database" | "admin";
}

export interface LearningProgressState {
  stageStatus: Record<string, LearningStageStatus>;
  completedItems: Record<string, boolean>;
  favoriteItems: Record<string, boolean>;
  notesByItem: Record<string, string>;
  moduleNotes: string;
  updatedAt?: string;
}

export const createEmptyLearningProgress = (): LearningProgressState => ({
  stageStatus: {},
  completedItems: {},
  favoriteItems: {},
  notesByItem: {},
  moduleNotes: "",
});
```

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
```

Expected output: TypeScript completes without errors, or only pre-existing unrelated errors are reported.

## Task 2: Create shared frontend learning helpers

Create `frontend/src/pages/Admin/ITTechnology/learning/helpers.ts` with the following code:

```ts
import { api } from "@services";
import type { LearningContentItem, LearningModuleKey, LearningProgressState, LearningStageStatus } from "./types";
import { createEmptyLearningProgress } from "./types";

export const normalizeLearningProgress = (value: unknown): LearningProgressState => {
  const empty = createEmptyLearningProgress();
  if (!value || typeof value !== "object") return empty;
  const raw = value as Partial<LearningProgressState> & Record<string, unknown>;
  return {
    stageStatus: isRecord(raw.stageStatus) ? normalizeStageStatus(raw.stageStatus) : empty.stageStatus,
    completedItems: isBooleanRecord(raw.completedItems) ? raw.completedItems : empty.completedItems,
    favoriteItems: isBooleanRecord(raw.favoriteItems) ? raw.favoriteItems : empty.favoriteItems,
    notesByItem: isStringRecord(raw.notesByItem) ? raw.notesByItem : empty.notesByItem,
    moduleNotes: typeof raw.moduleNotes === "string" ? raw.moduleNotes : typeof raw.notes === "string" ? raw.notes : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
};

export const mergeContentItems = <T extends LearningContentItem>(fallback: T[], remote: LearningContentItem[] | null): T[] => {
  if (!remote || remote.length === 0) return fallback;
  const enabledRemote = remote.filter((item) => item.enabled !== false);
  if (enabledRemote.length === 0) return fallback;
  const fallbackMap = new Map(fallback.map((item) => [`${item.section_key}:${item.item_key}`, item]));
  enabledRemote.forEach((item) => {
    fallbackMap.set(`${item.section_key}:${item.item_key}`, item as T);
  });
  return Array.from(fallbackMap.values()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
};

export const fetchLearningContent = async (moduleKey: LearningModuleKey): Promise<LearningContentItem[] | null> => {
  try {
    const response = await api.get<{ data?: LearningContentItem[] }>(`/learning/content/${moduleKey}`);
    return Array.isArray(response.data?.data) ? response.data.data : null;
  } catch {
    return null;
  }
};

export const filterByKeyword = <T extends { title?: string; name?: string; summary?: string; description?: string; desc?: string; tags?: string[] }>(items: T[], keyword: string): T[] => {
  const q = keyword.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => [item.title, item.name, item.summary, item.description, item.desc, ...(item.tags ?? [])]
    .filter(Boolean)
    .some((part) => String(part).toLowerCase().includes(q)));
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "boolean");
};

const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
};

const normalizeStageStatus = (value: Record<string, unknown>): Record<string, LearningStageStatus> => {
  const result: Record<string, LearningStageStatus> = {};
  Object.entries(value).forEach(([key, status]) => {
    if (status === "pending" || status === "in-progress" || status === "completed") result[key] = status;
  });
  return result;
};
```

Run frontend type-check and fix any import path or generic errors.

## Task 3: Add backend learning content model

Create `backend/app/models/learning/content.py` with this code:

```py
"""学习内容配置模型。"""

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint, func

from app.db.database import Base


class LearningContentItem(Base):
    """学习模块内容项。"""

    __tablename__ = "sys_learning_content_items"
    __table_args__ = (
        UniqueConstraint("module_key", "section_key", "item_key", name="uq_sys_learning_content_module_section_item"),
        {"comment": "学习内容配置表"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    module_key = Column(String(50), nullable=False, index=True, comment="模块标识: ml, ai, agents")
    section_key = Column(String(80), nullable=False, index=True, comment="内容分区")
    item_key = Column(String(120), nullable=False, comment="内容项唯一标识")
    title = Column(String(255), nullable=False, comment="标题")
    summary = Column(Text, nullable=True, comment="摘要")
    content = Column(Text, nullable=False, comment="结构化内容 JSON")
    tags = Column(Text, nullable=True, comment="标签 JSON 数组")
    difficulty = Column(String(50), nullable=True, comment="难度")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0", comment="排序")
    enabled = Column(Boolean, nullable=False, default=True, server_default="true", comment="是否启用")
    source_type = Column(String(50), nullable=False, default="admin", server_default="admin", comment="来源")
    created_at = Column(DateTime, server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
```

Modify `backend/app/models/learning/__init__.py` to export `LearningContentItem` along with `LearningProgress`.

Modify `backend/app/models/__init__.py` to import `LearningContentItem` and add it to `__all__`.

Run:

```bash
cd /Users/wsh/wangsh/backend && python -m py_compile app/models/learning/content.py app/models/learning/__init__.py app/models/__init__.py
```

Expected output: no output and exit code 0.

## Task 4: Add backend learning content schemas

Create `backend/app/schemas/learning/content.py` with this code:

```py
"""学习内容配置 Schema。"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class LearningContentItemIn(BaseModel):
    section_key: str = Field(..., min_length=1, max_length=80)
    item_key: str = Field(..., min_length=1, max_length=120)
    title: str = Field(..., min_length=1, max_length=255)
    summary: Optional[str] = None
    content: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    difficulty: Optional[str] = Field(None, max_length=50)
    sort_order: int = 0
    enabled: bool = True
    source_type: str = Field("admin", max_length=50)


class LearningContentItemOut(LearningContentItemIn):
    id: int
    module_key: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

Modify `backend/app/schemas/learning/__init__.py` to export these schemas.

Run py_compile for the new schema and package init.

## Task 5: Add backend content endpoints

Create `backend/app/api/endpoints/learning/content.py` with GET and admin upsert endpoints. GET `/learning/content/{module_key}` returns enabled items sorted by section and order. PUT `/learning/content/{module_key}/{section_key}/{item_key}` upserts an item for admins if an admin dependency exists; otherwise defer admin writes and implement only GET in the first pass.

The GET endpoint should return plain lists like existing endpoints and should parse JSON text safely, matching `progress.py` style.

Modify `backend/app/api/endpoints/learning/__init__.py` to include the new router with `prefix=""` and tag `learning`.

Run:

```bash
cd /Users/wsh/wangsh/backend && python -m py_compile app/api/endpoints/learning/content.py app/api/endpoints/learning/__init__.py
```

Expected output: no output and exit code 0.

## Task 6: Add Alembic migration

Create `backend/alembic/versions/20260503_0002_learning_content_items.py` with a migration whose `down_revision` is `20260503_0001_learning_progress`. It must create `sys_learning_content_items` with the columns from the model and unique constraint `uq_sys_learning_content_module_section_item`. Include idempotent `_table_exists` helper following the style of `20260503_0001_learning_progress.py`.

Run:

```bash
cd /Users/wsh/wangsh/backend && python -m py_compile alembic/versions/20260503_0002_learning_content_items.py
```

Expected output: no output and exit code 0.

## Task 7: Extract ML data and add interactions

Create `frontend/src/pages/Admin/ITTechnology/ml/data.ts` and move `ROADMAP_STAGES`, `KNOWLEDGE_TREE`, `EXPERIMENTS`, `TOOLS_DATA`, `RESOURCES_DATA`, category labels, and configs from `ml/index.tsx` into this file. Export them.

Modify `ml/index.tsx` to import data from `./data`. Add local state for `experimentKeyword`, `experimentDifficulty`, `toolKeyword`, `toolCategory`, `resourceKeyword`, and `resourceType`. Add filter controls above experiments, tools, and resources. Use `useMemo` for filtered lists and grouped tools.

Extend progress state to support item completion and favorites using the shared `LearningProgressState` shape while preserving the current `stages` fallback normalization.

Run `npm run type-check` and fix errors.

## Task 8: Extract AI data and remove forced tab mounting

Create `frontend/src/pages/Admin/ITTechnology/ai/data.ts` and move static arrays from `ai/index.tsx` into it. Modify `ai/index.tsx` to import them.

Remove `forceMount` from AI tabs unless a specific component needs it. Add keyword/category filtering to the tools tab. Add prompt template copy buttons using `navigator.clipboard.writeText` with a fallback error toast. Add resource/progress item completion using progress JSON.

Run `npm run type-check` and fix errors.

## Task 9: Extract Agents data and lazy-render Mermaid

Create `frontend/src/pages/Admin/ITTechnology/agents/data.ts` and move `roadmapStages`, `agentCoreArchitecture`, `agentTypeComparison`, `coreTechs`, `frameworkData`, `experimentLevels`, and `defaultProgress` into it.

Modify `agents/index.tsx` to import the data. Render `KnowledgeTab` only when active or pass active state so `MermaidDiagram` does not initialize while hidden. Add framework keyword/scenario filter and experiment difficulty filter.

Run `npm run type-check` and fix errors.

## Task 10: Wire frontend content API fallback

Use `fetchLearningContent` in each module to attempt loading backend content. If no backend content exists, keep built-in data. Add a small non-blocking hint such as “当前使用内置学习内容” only when useful and not noisy. Do not block page load on content API failure.

Run `npm run type-check`.

## Task 11: Update docs

Modify `docs/development/API.md` to document `GET /learning/content/{module_key}` and any admin write endpoints that were actually implemented.

Modify `docs/development/CLAUDE_MEMORY.md` section 17 to note that the learning pages now support built-in-plus-extensible content and richer progress interactions.

Run:

```bash
cd /Users/wsh/wangsh && git diff --check
```

Expected output: no whitespace errors.

## Task 12: Final verification

Run:

```bash
cd /Users/wsh/wangsh/frontend && npm run type-check
cd /Users/wsh/wangsh/backend && python -m py_compile app/models/learning/content.py app/schemas/learning/content.py app/api/endpoints/learning/content.py alembic/versions/20260503_0002_learning_content_items.py
cd /Users/wsh/wangsh && git diff --check
```

If the local dev server is available, verify in browser:

```text
http://localhost:6608/admin/it-technology
http://localhost:6608/it-technology/ml
http://localhost:6608/it-technology/ai
http://localhost:6608/it-technology/agents
```

Expected result: pages render, tabs switch, filters respond, progress saves, and no new console errors appear.

## Self-Review

This plan covers backend content extensibility, frontend decomposition, interactions, performance, documentation, and verification. It intentionally avoids building a full CMS in the first slice. It keeps the existing progress API compatible and avoids changing public routes. The plan contains exact file paths and verification commands. The only adaptive point is whether an existing admin dependency is available for content write endpoints; if not, GET-only content extensibility is acceptable for the first implementation because built-in fallback remains the authoritative seed.
