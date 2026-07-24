# IT 游戏资源库

> 最后更新：2026-07-22

## 概述

IT 游戏资源库模块为信息技术教学场景提供教学游戏安装包的上传、管理和分发功能。支持按分类浏览、关键词搜索、登录下载，并完整记录每次下载操作。

### 核心功能
- **分类浏览**：按益智、动作、模拟、工具等分类筛选游戏
- **关键词搜索**：支持按标题和描述进行模糊搜索
- **安全下载**：登录认证后方可下载，记录 IP 和 User-Agent
- **管理后台**：支持游戏上传、编辑、上下架、删除及下载日志查看
- **文件安全**：扩展名白名单 + magic byte 签名校验 + 路径防穿越 + SHA256 校验

---

## 架构设计

### 数据模型

**核心表**：
- `it_games` (GameResource) — 游戏资源元数据表
- `it_game_download_logs` (GameDownloadLog) — 下载记录表

**GameResource 关键字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `title` | String(200) | 游戏名称 |
| `description` | Text | 游戏简介 |
| `category` | String(100) | 分类（益智、动作、模拟、工具等） |
| `filename` | String(300) | 原始上传文件名 |
| `stored_path` | String(500) | 服务器存储路径 |
| `file_size` | Integer | 文件大小（字节） |
| `file_mime` | String(100) | MIME 类型 |
| `file_sha256` | String(64) | SHA256 校验值 |
| `icon_url` | String(500) | 封面/图标 URL |
| `download_count` | Integer | 下载次数（冗余计数） |
| `is_active` | Boolean | 是否上架 |
| `uploaded_by` | Integer (FK -> sys_users.id) | 上传者 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**GameDownloadLog 关键字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键，自增 |
| `game_id` | Integer (FK -> it_games.id, CASCADE) | 游戏 ID |
| `user_id` | Integer (FK -> sys_users.id, SET NULL) | 下载用户 |
| `ip_address` | String(45) | 客户端 IP |
| `user_agent` | String(500) | 浏览器 User-Agent |
| `downloaded_at` | DateTime | 下载时间 |

### 文件存储

游戏文件存储在 `settings.UPLOAD_FOLDER/games/` 目录下（默认为 `./uploads/games/`），命名格式为 `{game_id}_{slug}{ext}`，其中 `slug` 由游戏标题生成的 URL 安全字符串。

上传目录在首次上传时自动创建。上传先写入同目录临时文件，完成格式校验后使用
`os.replace` 原子切换为最终文件。元数据更新后会再次 flush 并提交事务，commit
成功后才 refresh ORM 对象，以加载数据库生成的时间戳供响应序列化使用。commit
前或 commit 失败会 rollback 并清理临时/最终文件；commit 后的 refresh 失败会向上
抛出错误，但不会删除已提交记录对应的文件。删除时先把物理文件移入隔离名，数据库
提交成功后再清理；提交失败会恢复文件。

---

## API 端点

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/it/games` | 游戏列表，支持 `?category=&search=&page=&size=` 过滤，仅返回上架游戏 |
| `GET` | `/it/games/categories` | 获取所有分类列表（去重排序），响应为 `{"categories": [...]}` |
| `GET` | `/it/games/{id}` | 获取单个游戏详情 |

### 登录接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/it/games/{id}/download` | 下载游戏文件，需要登录认证，自动记录下载日志（IP + UA）并递增下载计数 |

### 管理接口（需要 ADMIN 权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/it/games` | 管理员列表，返回全部游戏（含已下架），支持分类筛选和搜索 |
| `POST` | `/admin/it/games` | 上传新游戏，multipart/form-data（`title`、`description`、`category`、`file`） |
| `PUT` | `/admin/it/games/{id}` | 编辑游戏元数据（标题、描述、分类、图标 URL、上下架状态） |
| `DELETE` | `/admin/it/games/{id}` | 删除游戏（数据库记录 + 物理文件） |
| `GET` | `/admin/it/games/{id}/logs` | 查看游戏下载记录，支持 `?page=&size=` 分页 |

---

## 安全设计

### 文件上传校验

- **扩展名白名单**：仅允许 `.zip`、`.rar`、`.7z`、`.exe`、`.msi`、`.dmg`、`.pkg`、`.apk`、`.iso`
- **Magic byte 签名验证**：检测文件头与实际扩展名是否一致，防止文件类型伪装（如将 `.exe` 伪装为 `.zip`）
- **文件大小上限**：默认 500 MiB，由 `IT_GAME_MAX_UPLOAD_BYTES` 配置；按 1 MiB 分块累计读取，超限即中止
- **路径穿越防护**：`resolve_game_file_path()` 从 `stored_path` 仅提取 basename，重新拼接到上传目录后 resolve，并校验结果仍在 `GAMES_UPLOAD_DIR` 内
- **SHA256 校验**：写入每个分块时增量计算，不重新加载完整文件
- **事务补偿**：上传提交失败会删除临时/最终文件；删除提交失败会恢复隔离文件
- **格式校验**：ZIP/APK/PE/MSI/7z/RAR/ISO/DMG/PKG 按各自真实签名位置检查，不只比较统一文件头

### 下载控制

- 下载接口需要登录认证（`get_current_user` 依赖注入）
- 每次下载自动记录：用户 ID、按统一可信代理规则解析的客户端 IP、浏览器 User-Agent
- `stored_path` 不直接暴露给前端，服务端通过 `resolve_game_file_path()` 安全重建文件路径后再返回
- 返回响应前先持有只读文件描述符；即使并发删除移动原路径，已开始的完整下载和
  Range 下载仍可从同一文件描述符完成

---

## 前端页面

- `/it-technology/games` — 公开浏览页面，支持分类筛选、搜索、查看详情和下载（需登录）
- `/admin/it-technology/games` — 管理员管理页面，支持上传、编辑、删除、查看下载日志

相关前端组件：
- `Pages/ITTechnology/GamesRepo.tsx` — 公开游戏仓库页面
- `Pages/ITTechnology/components/GameCard.tsx` — 游戏卡片组件
- `Pages/ITTechnology/components/GameDetailModal.tsx` — 游戏详情弹窗
- `Pages/ITTechnology/components/GameUploadModal.tsx` — 游戏上传弹窗
- `Pages/Admin/ITTechnology/GamesManager.tsx` — 管理员游戏管理页面

---

## 相关文档

- [API 参考](../development/API.md) — 完整 API 规格
- [数据库性能指南](../DATABASE_PERFORMANCE_GUIDE.md)
