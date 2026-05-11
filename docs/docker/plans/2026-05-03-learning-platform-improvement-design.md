---
status: reference
owner: frontend
最近复核: 2026-05-10
---

# IT Technology Learning Platform Improvement Design

> Date: 2026-05-03
> Scope: `/admin/it-technology` and public `/it-technology/{ml,ai,agents}` learning modules

## Goal

Upgrade the machine learning, artificial intelligence exploration, and agent exploration pages from large static knowledge displays into a full-stack, built-in-plus-extensible learning platform. The pages should keep their current rich knowledge structure, but support configurable learning content, stronger learner interactions, durable progress tracking, and better frontend performance.

## Current Problems

The three pages currently contain most learning material as static arrays inside very large page files. This makes the content feel like mock data even when the material is useful, and it makes future updates difficult. The interaction model is uneven: ML supports simple stage status and notes, AI supports stage status, and Agents supports stage progress, but experiments, tools, resources, templates, and framework choices are mostly read-only. Performance risk is also increasing because the large files render many sections directly, some tabs force-mount hidden content, and the Agents page renders Mermaid diagrams through iframes.

## Recommended Architecture

Use a lightweight full-stack content layer rather than building a full CMS. The backend should expose learning content items by module and section. Each item stores structured JSON content so the first iteration can support roadmap stages, knowledge nodes, experiments, tools, resources, templates, cases, and framework rows without creating many specialized tables.

The frontend should treat built-in content as a fallback and extension seed. Each module owns its own curated content file, while shared hooks and types normalize backend content, local fallback content, progress data, search/filter state, and save actions. This preserves module-specific design while avoiding repeated API and progress logic.

## Backend Design

Add a new model tentatively named `LearningContentItem` mapped to `sys_learning_content_items`. Proposed fields are `id`, `module_key`, `section_key`, `item_key`, `title`, `summary`, `content`, `tags`, `difficulty`, `sort_order`, `enabled`, `source_type`, `created_at`, and `updated_at`. `module_key` is limited to `ml`, `ai`, and `agents`. `section_key` groups content such as `roadmap`, `knowledge`, `experiments`, `tools`, `resources`, `prompt`, `ethics`, `frameworks`, and `core-tech`. `content` and `tags` can be stored as JSON text to stay consistent with the existing progress implementation and avoid PostgreSQL-specific coupling in the first slice.

Public/authenticated read endpoints should return enabled content for a module. Admin endpoints can later support editing, but the first implementation can safely provide list/upsert/toggle endpoints if existing admin dependencies are clear. The existing `/learning/progress/{module_key}` API remains compatible and continues to store per-user state in `progress_data`.

Because this adds a table, it requires an Alembic migration and the new model must be imported from `backend/app/models/__init__.py`.

## Frontend Design

Create shared frontend types and helpers under `frontend/src/pages/Admin/ITTechnology/learning/` or a nearby module-specific shared directory. The shared layer should include a `LearningModuleContent` shape, progress status utilities, content fetch helpers, and pure filtering helpers.

Split each large page into a folder structure. For example, ML should move static data to `ml/data.ts`, local types to `ml/types.ts`, and cards/tabs into `ml/components/`. AI and Agents should follow the same pattern only where it reduces file size and improves clarity; avoid over-abstracting visual layouts because the three modules are intentionally different.

Content loading should follow a fallback pattern: render built-in content immediately, request backend content, then merge or replace enabled sections when backend data exists. If backend content fails, the page should show a small non-blocking warning and continue with built-in content.

## Interaction Design

Add consistent, low-risk interactions across the three pages. Roadmap stages should support status changes. Experiments should support filtering by difficulty and marking completion. Tools/resources/frameworks should support keyword search and category filters. Resources and tools should support “已学习/收藏” style user actions stored in `progress_data`. AI Prompt templates should support copy actions. Agents framework comparison should keep selected framework state and add filtering by scenario or difficulty.

The progress shape should become richer but remain JSON-compatible. A recommended shape is `stageStatus`, `completedItems`, `favoriteItems`, `notesByItem`, `moduleNotes`, and `updatedAt`. Existing saved shapes should be normalized on load so current users do not lose progress.

## Performance Design

Render only the active tab unless there is a clear reason to keep hidden content mounted. Use memoized derived data for grouped tools, filtered resources, filtered experiments, and progress statistics. Lazy-render heavyweight visual sections such as Mermaid diagrams only when the relevant tab is active. Keep search/filter state local to each tab to avoid triggering unrelated re-renders. Use `React.memo` for repeated cards after component extraction.

## Error Handling

Content API failures should not block learning pages because built-in content exists. Progress save failures should still show `showMessage.error`. Invalid backend content should be ignored section-by-section rather than crashing the whole page. Any new backend write path should roll back on database exceptions and return project-standard API responses.

## Testing and Verification

Frontend verification should include `npm run type-check` in `frontend/`. Backend verification should include Python import/compile checks for the new model, schema, endpoints, and Alembic migration. If the dev server is running, browser verification should cover `/admin/it-technology`, `/it-technology/ml`, `/it-technology/ai`, and `/it-technology/agents`, including tab switching, filtering, and progress saving.

## Implementation Slices

The safest first slice is to add shared types/helpers, extract module data out of the three page files, add search/filter and richer progress interactions while preserving current UI. The second slice adds backend content item storage and read endpoints. The third slice wires frontend content loading to backend fallback. The fourth slice updates documentation and runs verification.
