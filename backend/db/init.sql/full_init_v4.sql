-- ============================================
-- 数据库完全初始化脚本 v4.0
-- 增强数据保护机制，支持快照和历史记录
-- 最后更新：2026-02-14
-- 特性：
-- 1. 增强的znt_conversations表（user_name/agent_name快照）
-- 2. 包含已删除实体的视图
-- 3. 三级数据保护机制
-- 4. 小组讨论（按日期+组号分组）与管理端分析留存
-- 5. 新增 IT技术支持相关表 (xxjs_dianming)
-- ============================================

-- 记录开始时间
DO $$
BEGIN
    RAISE NOTICE '🚀 开始数据库完全初始化（v4.0）...';
    RAISE NOTICE '    时间: %', NOW();
    RAISE NOTICE '    目标：创建增强数据保护机制的数据库';
    RAISE NOTICE '    特性：快照保护、软删除、完整历史记录、IT技术支持';
END $$;

-- ============================================
-- 第一步：清理所有现有表（完全重置）
-- ============================================

DO $$
BEGIN
    RAISE WARNING '⚠️  ⚠️  ⚠️  完全重置数据库！';
    RAISE NOTICE '    将删除所有现有表和视图';
    RAISE NOTICE '    此操作不可逆，仅用于开发和测试环境';
    RAISE NOTICE '';
END $$;

-- 暂停等待确认（实际执行时通过脚本控制）
-- 在实际执行时，应该通过命令行参数控制

-- 清理顺序：先删除外键约束，再删除表
-- 1. 删除外键约束
ALTER TABLE IF EXISTS wz_articles DROP CONSTRAINT IF EXISTS wz_articles_author_id_fkey;
ALTER TABLE IF EXISTS wz_articles DROP CONSTRAINT IF EXISTS wz_articles_category_id_fkey;
ALTER TABLE IF EXISTS znt_conversations DROP CONSTRAINT IF EXISTS znt_conversations_user_id_fkey;
ALTER TABLE IF EXISTS znt_conversations DROP CONSTRAINT IF EXISTS znt_conversations_agent_id_fkey;
ALTER TABLE IF EXISTS znt_group_discussion_sessions DROP CONSTRAINT IF EXISTS znt_group_discussion_sessions_created_by_user_id_fkey;
ALTER TABLE IF EXISTS znt_group_discussion_messages DROP CONSTRAINT IF EXISTS znt_group_discussion_messages_session_id_fkey;
ALTER TABLE IF EXISTS znt_group_discussion_messages DROP CONSTRAINT IF EXISTS znt_group_discussion_messages_user_id_fkey;
ALTER TABLE IF EXISTS znt_group_discussion_analyses DROP CONSTRAINT IF EXISTS znt_group_discussion_analyses_session_id_fkey;
ALTER TABLE IF EXISTS znt_group_discussion_analyses DROP CONSTRAINT IF EXISTS znt_group_discussion_analyses_agent_id_fkey;
ALTER TABLE IF EXISTS znt_group_discussion_analyses DROP CONSTRAINT IF EXISTS znt_group_discussion_analyses_created_by_admin_user_id_fkey;
ALTER TABLE IF EXISTS znt_data DROP CONSTRAINT IF EXISTS znt_data_agent_id_fkey;
ALTER TABLE IF EXISTS znt_data DROP CONSTRAINT IF EXISTS znt_data_user_id_fkey;
ALTER TABLE IF EXISTS sys_refresh_tokens DROP CONSTRAINT IF EXISTS sys_refresh_tokens_user_id_fkey;

-- 2. 删除所有视图
DROP VIEW IF EXISTS v_conversations_with_deleted CASCADE;

-- 3. 删除所有表（按依赖顺序）
DROP TABLE IF EXISTS alembic_version CASCADE;
DROP TABLE IF EXISTS sys_role_permissions CASCADE;
DROP TABLE IF EXISTS sys_permissions CASCADE;
DROP TABLE IF EXISTS znt_conversations CASCADE;
DROP TABLE IF EXISTS znt_group_discussion_analyses CASCADE;
DROP TABLE IF EXISTS znt_group_discussion_messages CASCADE;
DROP TABLE IF EXISTS znt_group_discussion_sessions CASCADE;
DROP TABLE IF EXISTS znt_data CASCADE;
DROP TABLE IF EXISTS wz_articles CASCADE;
DROP TABLE IF EXISTS wz_categories CASCADE;
DROP TABLE IF EXISTS znt_agents CASCADE;
DROP TABLE IF EXISTS znt_users CASCADE;
DROP TABLE IF EXISTS sys_refresh_tokens CASCADE;
DROP TABLE IF EXISTS sys_users_backup CASCADE;
DROP TABLE IF EXISTS znt_users_backup CASCADE;
DROP TABLE IF EXISTS znt_moxing CASCADE;
DROP TABLE IF EXISTS xxjs_dianming CASCADE;
DROP TABLE IF EXISTS xbk_selections CASCADE;
DROP TABLE IF EXISTS xbk_courses CASCADE;
DROP TABLE IF EXISTS xbk_students CASCADE;
DROP TABLE IF EXISTS sys_feature_flags CASCADE;
DROP TABLE IF EXISTS sys_users CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ 旧表清理完成';
END $$;

-- ============================================
-- 第二步：安装 PostgreSQL 扩展
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
    RAISE NOTICE '✅ PostgreSQL 扩展安装完成';
END $$;

-- ============================================
-- 第三步：创建核心表结构（v3.0增强版）
-- ============================================

-- 1. 统一用户表（管理员+学生）
CREATE TABLE sys_users (
    id SERIAL PRIMARY KEY,
    
    -- 登录凭证（超级管理员和管理员使用）
    username VARCHAR(50) UNIQUE,
    hashed_password VARCHAR(255),
    
    -- 基本信息
    full_name VARCHAR(100) NOT NULL,
    
    -- 学生专用字段（仅学生用户使用）
    student_id VARCHAR(50) UNIQUE,
    class_name VARCHAR(50),
    study_year VARCHAR(10),  -- 年份，如"2025"
    
    -- 角色标识
    role_code VARCHAR(20) NOT NULL DEFAULT 'student',  -- super_admin, admin, student, guest
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 权限定义表
CREATE TABLE sys_permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,  -- 权限代码
    name VARCHAR(100) NOT NULL          -- 权限名称
);

-- 3. 角色权限映射表
CREATE TABLE sys_role_permissions (
    role_code VARCHAR(20) NOT NULL,
    permission_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (role_code, permission_code)
);

-- 4. 刷新令牌表
CREATE TABLE sys_refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_tokens_user_id ON sys_refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON sys_refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires ON sys_refresh_tokens(expires_at);

-- 4.1 系统功能开关表
CREATE TABLE sys_feature_flags (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sys_feature_flags_key ON sys_feature_flags(key);

-- 4.2 XBK（校本课）模块表
CREATE TABLE xbk_students (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    term VARCHAR(20) NOT NULL,
    class_name VARCHAR(50) NOT NULL,
    student_no VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    CONSTRAINT uq_xbk_students_year_term_student_no UNIQUE (year, term, student_no)
);
CREATE INDEX idx_xbk_students_year_term ON xbk_students(year, term);
CREATE INDEX idx_xbk_students_class_name ON xbk_students(class_name);

CREATE TABLE xbk_courses (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    term VARCHAR(20) NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    teacher VARCHAR(100),
    quota INTEGER NOT NULL DEFAULT 0,
    location VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    CONSTRAINT uq_xbk_courses_year_term_course_code UNIQUE (year, term, course_code)
);
CREATE INDEX idx_xbk_courses_year_term ON xbk_courses(year, term);
CREATE INDEX idx_xbk_courses_course_code ON xbk_courses(course_code);

CREATE TABLE xbk_selections (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    term VARCHAR(20) NOT NULL,
    student_no VARCHAR(50) NOT NULL,
    name VARCHAR(50),
    course_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    CONSTRAINT uq_xbk_selections_year_term_student_no_course_code UNIQUE (year, term, student_no, course_code)
);
CREATE INDEX idx_xbk_selections_year_term ON xbk_selections(year, term);
CREATE INDEX idx_xbk_selections_student_no ON xbk_selections(student_no);
CREATE INDEX idx_xbk_selections_course_code ON xbk_selections(course_code);

-- 4.4 IT技术支持模块表
CREATE TABLE xxjs_dianming (
    id SERIAL PRIMARY KEY,
    year VARCHAR(20) NOT NULL,
    class_name VARCHAR(50) NOT NULL,
    student_name VARCHAR(50) NOT NULL,
    student_no VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false
);
CREATE INDEX idx_xxjs_dianming_year_class ON xxjs_dianming(year, class_name);
CREATE UNIQUE INDEX uq_xxjs_dianming_student ON xxjs_dianming(year, class_name, student_name);

-- 4.3 Informatics（信息学）模块表
CREATE TABLE inf_typst_notes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(500) NOT NULL DEFAULT '',
    category_path VARCHAR(200) NOT NULL DEFAULT '',
    published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    style_key VARCHAR(100) NOT NULL DEFAULT 'my_style',
    entry_path VARCHAR(200) NOT NULL DEFAULT 'main.typ',
    files JSONB NOT NULL DEFAULT '{}'::jsonb,
    toc JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_typst TEXT NOT NULL DEFAULT '',
    created_by_id INTEGER,
    compiled_hash VARCHAR(64),
    compiled_pdf BYTEA,
    compiled_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_inf_typst_notes_updated_at ON inf_typst_notes(updated_at);
CREATE INDEX idx_inf_typst_notes_created_by_id ON inf_typst_notes(created_by_id);
CREATE INDEX idx_inf_typst_notes_is_deleted ON inf_typst_notes(is_deleted);
CREATE INDEX idx_inf_typst_notes_published ON inf_typst_notes(published);

CREATE TABLE inf_typst_assets (
    id SERIAL PRIMARY KEY,
    note_id INTEGER NOT NULL,
    path VARCHAR(400) NOT NULL,
    mime VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    content BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_inf_typst_assets_note_id ON inf_typst_assets(note_id);
CREATE UNIQUE INDEX uq_inf_typst_assets_note_path ON inf_typst_assets(note_id, path);

CREATE TABLE inf_typst_styles (
    key VARCHAR(100) PRIMARY KEY,
    title VARCHAR(200) NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_inf_typst_styles_sort ON inf_typst_styles(sort_order);

CREATE TABLE inf_typst_categories (
    id SERIAL PRIMARY KEY,
    path VARCHAR(200) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_inf_typst_categories_sort ON inf_typst_categories(sort_order);

-- 5. 智能体配置表
CREATE TABLE znt_agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    agent_type VARCHAR(20) NOT NULL,      -- general/dify/custom/openai/azure/anthropic
    model_name VARCHAR(100),              -- 模型名称，如：deepseek-chat, gpt-4, 深度思考等
    api_endpoint VARCHAR(500),
    api_key VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 5. 对话记录表（增强版 - 支持快照保护）
CREATE TABLE znt_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    user_name VARCHAR(100),               -- 用户名快照（删除时保留）
    agent_id INTEGER,
    agent_name VARCHAR(200),              -- 智能体名称快照
    session_id VARCHAR(100),
    message_type VARCHAR(20) NOT NULL,    -- question/answer/system
    content TEXT NOT NULL,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. 小组讨论会话表（按日期+班级+组号分组）
CREATE TABLE znt_group_discussion_sessions (
    id SERIAL PRIMARY KEY,
    session_date DATE NOT NULL,
    class_name VARCHAR(64) NOT NULL,
    group_no VARCHAR(16) NOT NULL,
    group_name VARCHAR(64),
    created_by_user_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0,
    CONSTRAINT uq_znt_group_discussion_sessions_date_class_group UNIQUE (session_date, class_name, group_no)
);
CREATE INDEX idx_znt_group_discussion_sessions_session_date ON znt_group_discussion_sessions(session_date);
CREATE INDEX idx_znt_group_discussion_sessions_class_name ON znt_group_discussion_sessions(class_name);
CREATE INDEX idx_znt_group_discussion_sessions_group_no ON znt_group_discussion_sessions(group_no);
CREATE INDEX idx_znt_group_discussion_sessions_group_name ON znt_group_discussion_sessions(group_name);
CREATE INDEX idx_znt_group_discussion_sessions_last_message_at ON znt_group_discussion_sessions(last_message_at);

-- 7. 小组讨论成员表
CREATE TABLE znt_group_discussion_members (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    muted_until TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_group_session_user UNIQUE (session_id, user_id)
);
CREATE INDEX idx_znt_group_discussion_members_session_id ON znt_group_discussion_members(session_id);
CREATE INDEX idx_znt_group_discussion_members_user_id ON znt_group_discussion_members(user_id);
CREATE INDEX idx_znt_group_discussion_members_joined_at ON znt_group_discussion_members(joined_at);

-- 8. 小组讨论消息表
CREATE TABLE znt_group_discussion_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_display_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_znt_group_discussion_messages_session_id_id ON znt_group_discussion_messages(session_id, id);
CREATE INDEX idx_znt_group_discussion_messages_session_id_created_at ON znt_group_discussion_messages(session_id, created_at);
CREATE INDEX idx_znt_group_discussion_messages_user_id_created_at ON znt_group_discussion_messages(user_id, created_at);

-- 9. 小组讨论分析结果表
CREATE TABLE znt_group_discussion_analyses (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    created_by_admin_user_id INTEGER NOT NULL,
    analysis_type VARCHAR(32) NOT NULL,
    prompt TEXT NOT NULL,
    result_text TEXT NOT NULL,
    compare_session_ids TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_znt_group_discussion_analyses_session_id_created_at ON znt_group_discussion_analyses(session_id, created_at);
CREATE INDEX idx_znt_group_discussion_analyses_agent_id ON znt_group_discussion_analyses(agent_id);

-- 6. 文章表
CREATE TABLE wz_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    author_id INTEGER,
    category_id INTEGER,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. 文章分类表
CREATE TABLE wz_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Alembic版本表（迁移版本控制）
-- INSERT INTO alembic_version (version_num) VALUES ('36b22173a652');
-- 注意：这里通常由 Alembic 管理，但在完全重置时可以预置


DO $$
BEGIN
    RAISE NOTICE '✅ 13个核心表创建完成（v4.0增强版）';
END $$;

-- ============================================
-- 第四步：创建索引（优化查询性能）
-- ============================================

-- sys_users 索引
CREATE INDEX idx_sys_users_role_code ON sys_users(role_code);
CREATE INDEX idx_sys_users_is_active ON sys_users(is_active);
CREATE INDEX idx_sys_users_is_deleted ON sys_users(is_deleted);
CREATE INDEX idx_sys_users_created_at ON sys_users(created_at);

-- 部分唯一索引：只对非空的student_id进行唯一性约束
CREATE UNIQUE INDEX uq_sys_users_student_id_not_null 
ON sys_users (student_id) 
WHERE student_id IS NOT NULL;

-- sys_permissions 索引
CREATE INDEX idx_sys_permissions_code ON sys_permissions(code);

-- sys_role_permissions 索引
CREATE INDEX idx_sys_role_permissions_role_code ON sys_role_permissions(role_code);
CREATE INDEX idx_sys_role_permissions_permission_code ON sys_role_permissions(permission_code);

-- znt_agents 索引
CREATE INDEX idx_znt_agents_is_active ON znt_agents(is_active);
CREATE INDEX idx_znt_agents_is_deleted ON znt_agents(is_deleted);
CREATE INDEX idx_znt_agents_created_at ON znt_agents(created_at);

-- znt_conversations 索引（增强）
CREATE INDEX idx_znt_conversations_user_id ON znt_conversations(user_id);
CREATE INDEX idx_znt_conversations_agent_id ON znt_conversations(agent_id);
CREATE INDEX idx_znt_conversations_created_at ON znt_conversations(created_at);
CREATE INDEX idx_znt_conversations_session_id ON znt_conversations(session_id);
CREATE INDEX idx_znt_conversations_user_agent_names ON znt_conversations(user_name, agent_name);

-- wz_articles 索引
CREATE INDEX idx_wz_articles_author_id ON wz_articles(author_id);
CREATE INDEX idx_wz_articles_category_id ON wz_articles(category_id);
CREATE INDEX idx_wz_articles_published ON wz_articles(published);
CREATE INDEX idx_wz_articles_created_at ON wz_articles(created_at);

DO $$
BEGIN
    RAISE NOTICE '✅ 索引创建完成';
END $$;

-- ============================================
-- 第五步：创建外键约束（保护数据完整性）
-- ============================================

-- wz_articles 外键
ALTER TABLE wz_articles
    ADD CONSTRAINT wz_articles_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES sys_users(id) ON DELETE SET NULL;

ALTER TABLE wz_articles
    ADD CONSTRAINT wz_articles_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES wz_categories(id);

-- znt_conversations 外键（增强保护）
ALTER TABLE znt_conversations
    ADD CONSTRAINT znt_conversations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE SET NULL;

ALTER TABLE znt_conversations
    ADD CONSTRAINT znt_conversations_agent_id_fkey 
    FOREIGN KEY (agent_id) REFERENCES znt_agents(id) ON DELETE SET NULL;

-- 小组讨论外键
ALTER TABLE znt_group_discussion_sessions
    ADD CONSTRAINT znt_group_discussion_sessions_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES sys_users(id) ON DELETE SET NULL;

ALTER TABLE znt_group_discussion_messages
    ADD CONSTRAINT znt_group_discussion_messages_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES znt_group_discussion_sessions(id) ON DELETE CASCADE;

ALTER TABLE znt_group_discussion_members
    ADD CONSTRAINT znt_group_discussion_members_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES znt_group_discussion_sessions(id) ON DELETE CASCADE;

ALTER TABLE znt_group_discussion_members
    ADD CONSTRAINT znt_group_discussion_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE;

ALTER TABLE znt_group_discussion_messages
    ADD CONSTRAINT znt_group_discussion_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES sys_users(id);

ALTER TABLE znt_group_discussion_analyses
    ADD CONSTRAINT znt_group_discussion_analyses_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES znt_group_discussion_sessions(id) ON DELETE CASCADE;

ALTER TABLE znt_group_discussion_analyses
    ADD CONSTRAINT znt_group_discussion_analyses_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES znt_agents(id);

ALTER TABLE znt_group_discussion_analyses
    ADD CONSTRAINT znt_group_discussion_analyses_created_by_admin_user_id_fkey
    FOREIGN KEY (created_by_admin_user_id) REFERENCES sys_users(id);

DO $$
BEGIN
    RAISE NOTICE '✅ 外键约束创建完成（使用ON DELETE SET NULL保护数据）';
END $$;

-- ============================================
-- 第六步：创建增强视图
-- ============================================

-- 1. 包含已删除实体的对话视图
CREATE VIEW v_conversations_with_deleted AS
SELECT
    c.id,
    c.user_id,
    COALESCE(c.user_name, u.full_name, '未知用户') AS display_user_name,
    c.agent_id,
    COALESCE(c.agent_name, a.name, '未知智能体') AS display_agent_name,
    c.session_id,
    c.message_type,
    c.content,
    c.response_time_ms,
    c.created_at,
    CASE
        WHEN u.id IS NULL OR u.is_deleted = true THEN true
        ELSE false
    END AS is_user_deleted,
    CASE
        WHEN a.id IS NULL OR a.is_deleted = true THEN true
        ELSE false
    END AS is_agent_deleted
FROM znt_conversations c
LEFT JOIN sys_users u ON c.user_id = u.id
LEFT JOIN znt_agents a ON c.agent_id = a.id;

DO $$
BEGIN
    RAISE NOTICE '✅ 增强视图 v_conversations_with_deleted 创建完成';
END $$;

-- ============================================
-- 第七步：插入基础数据（初始化数据）
-- ============================================

-- 1. 插入权限数据
INSERT INTO sys_permissions (code, name) VALUES
('system.full', '系统完全控制'),
('user.manage', '用户管理'),
('article.manage', '文章管理'),
('agent.manage', '智能体管理'),
('agent.use', '智能体使用');

-- 2. 插入角色权限映射
INSERT INTO sys_role_permissions (role_code, permission_code) VALUES
('super_admin', 'system.full'),       -- 超级管理员：所有权限
('admin', 'user.manage'),             -- 管理员：用户管理
('admin', 'article.manage'),          -- 管理员：文章管理
('admin', 'agent.manage'),            -- 管理员：智能体管理
('admin', 'agent.use'),               -- 管理员：智能体使用
('student', 'agent.use');              -- 学生：智能体使用

-- 3. 默认功能开关（XBK 默认不公开）
INSERT INTO sys_feature_flags (key, value) VALUES
('xbk_public_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;



-- 5. 插入示例学生（测试用）
INSERT INTO sys_users (full_name, student_id, class_name, study_year, role_code, is_active) VALUES
('张解决', '202300033', '高一(1)班', '2025', 'student', true),
('王五', '20220002', '高一(3)班', '2025', 'student', true);

-- 5. 插入默认智能体配置（不内置外部 API Endpoint；部署后在管理端配置）
INSERT INTO znt_agents (name, agent_type, api_endpoint, is_active) VALUES
('DeepSeek Chat', 'openai', '', true),
('默认Dify智能体', 'dify', '', true);

-- 7. 插入示例文章分类
INSERT INTO wz_categories (name, description, slug) VALUES
('信息技术', '计算机科学、编程、网络技术', 'it-technology'),
('信息学竞赛', '算法、数据结构、竞赛题目', 'informatics'),
('个人项目', '学生个人项目展示', 'personal-programs'),
('AI智能体', '人工智能、智能对话系统', 'ai-agents');

-- 8. 清空Alembic版本表，插入当前版本标记
-- INSERT INTO alembic_version (version_num) VALUES ('36b22173a652');

DO $$
BEGIN
    RAISE NOTICE '✅ 基础数据插入完成';
END $$;

-- ============================================
-- 第八步：验证初始化结果
-- ============================================

DO $$
DECLARE
    user_count INTEGER;
    permission_count INTEGER;
    agent_count INTEGER;
    category_count INTEGER;
    table_count INTEGER;
    view_count INTEGER;
    user_rec RECORD;
    agent_rec RECORD;
BEGIN
    -- 验证表数量
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    
    RAISE NOTICE '📊 表统计: % 个表', table_count;
    
    -- 验证视图数量
    SELECT COUNT(*) INTO view_count 
    FROM information_schema.views 
    WHERE table_schema = 'public';
    
    RAISE NOTICE '📊 视图统计: % 个视图', view_count;
    
    -- 验证用户数量
    SELECT COUNT(*) INTO user_count FROM sys_users WHERE is_deleted = false;
    RAISE NOTICE '📊 用户统计: % 个用户', user_count;
    
    -- 验证权限数量
    SELECT COUNT(*) INTO permission_count FROM sys_permissions;
    RAISE NOTICE '📊 权限统计: % 个权限', permission_count;
    
    -- 验证智能体数量
    SELECT COUNT(*) INTO agent_count FROM znt_agents WHERE is_deleted = false;
    RAISE NOTICE '📊 智能体统计: % 个智能体', agent_count;
    
    -- 验证分类数量
    SELECT COUNT(*) INTO category_count FROM wz_categories;
    RAISE NOTICE '📊 分类统计: % 个分类', category_count;
    
    -- 显示用户详情
    RAISE NOTICE '';
    RAISE NOTICE '👥 用户列表:';
    FOR user_rec IN 
        SELECT username, full_name, role_code, student_id, is_active 
        FROM sys_users 
        WHERE is_deleted = false 
        ORDER BY role_code, id
    LOOP
        RAISE NOTICE '    - % (%): % - %', 
            COALESCE(user_rec.username, user_rec.student_id), 
            user_rec.full_name, 
            user_rec.role_code,
            CASE WHEN user_rec.is_active THEN '✅ 激活' ELSE '❌ 停用' END;
    END LOOP;
    
    -- 显示智能体详情
    RAISE NOTICE '';
    RAISE NOTICE '🤖 智能体列表:';
    FOR agent_rec IN 
        SELECT name, agent_type, api_endpoint, is_active 
        FROM znt_agents 
        WHERE is_deleted = false 
        ORDER BY id
    LOOP
        RAISE NOTICE '    - % (%): % - %', 
            agent_rec.name, 
            agent_rec.agent_type,
            agent_rec.api_endpoint,
            CASE WHEN agent_rec.is_active THEN '✅ 激活' ELSE '❌ 停用' END;
    END LOOP;
END $$;

-- ============================================
-- 第九步：数据保护示例和说明
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔒 数据保护机制验证:';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '✅ 三级数据保护机制已启用:';
    RAISE NOTICE '    1. 软删除机制 (is_deleted字段)';
    RAISE NOTICE '    2. 外键保护 (ON DELETE SET NULL)';
    RAISE NOTICE '    3. 快照保护 (user_name/agent_name字段)';
    RAISE NOTICE '';
    RAISE NOTICE '💡 数据保护示例:';
    RAISE NOTICE '    -- 删除用户时:';
    RAISE NOTICE '    UPDATE sys_users SET is_deleted = true WHERE id = 123;';
    RAISE NOTICE '    -- 对话记录中的user_id变为NULL，但user_name保留';
    RAISE NOTICE '    -- 通过v_conversations_with_deleted视图仍可查看完整信息';
    RAISE NOTICE '';
    RAISE NOTICE '📊 验证快照保护:';
    RAISE NOTICE '    SELECT * FROM v_conversations_with_deleted;';
    RAISE NOTICE '    -- 即使user_id/agent_id为NULL，仍显示名称信息';
END $$;

-- ============================================
-- 第十步：初始化完成总结
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════';
    RAISE NOTICE '🎉 数据库完全初始化（v4.0）完成！';
    RAISE NOTICE '══════════════════════════════════════════════════';
    RAISE NOTICE '    时间: %', NOW();
    RAISE NOTICE '';
    RAISE NOTICE '📋 系统登录信息:';
    RAISE NOTICE '    - 超级管理员: admin / wangshuhao0727';
    RAISE NOTICE '    - 学生1: 张解决 / 202300033';
    RAISE NOTICE '    - 学生2: 王五 / 20220002';
    RAISE NOTICE '';
    RAISE NOTICE '🤖 智能体配置:';
    RAISE NOTICE '    - DeepSeek Chat (openai)';
    RAISE NOTICE '    - 默认Dify智能体 (dify)';
    RAISE NOTICE '';
    RAISE NOTICE '📚 文章分类:';
    RAISE NOTICE '    - 信息技术、信息学竞赛、个人项目、AI智能体';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 数据保护特性:';
    RAISE NOTICE '    - 软删除机制，支持数据恢复';
    RAISE NOTICE '    - 外键保护，保留历史关系';
    RAISE NOTICE '    - 快照保护，完整历史记录';
    RAISE NOTICE '    - 增强视图，显示已删除实体';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 技术支持:';
    RAISE NOTICE '    - 数据库设计文档: 数据库设计文档_v4.0.md';
    RAISE NOTICE '    - 初始化脚本: python3 init_database.py --force';
    RAISE NOTICE '    - 遗留表清理: cleanup_legacy_tables.sql';
    RAISE NOTICE '    - 迁移状态: v4.0 (增强数据保护)';
END $$;
