#!/usr/bin/env python3
"""
group_discussion.py 精确拆分脚本 V2

基于实际代码结构（34个函数）进行拆分。
执行前请确保已备份原文件并运行了相关测试。
"""

import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

# 配置
SOURCE_FILE = "backend/app/services/agents/group_discussion.py"
TARGET_DIR = "backend/app/services/agents/group_discussion"
BACKUP_FILE = f"{SOURCE_FILE}.backup"

# 函数分类映射（基于实际函数名分析）
FUNCTION_CATEGORIES = {
    "core.py": [
        "_gd_key",
        "_gd_metric_incr",
        "_normalize_group_no",
        "_normalize_class_name",
        "_normalize_group_name",
        "_display_name",
        "resolve_target_class_name",
    ],
    "session_service.py": [
        "get_or_create_today_session",
        "ensure_session_view_access",
        "list_today_groups",
        "set_group_name",
        "enforce_join_lock",
        "set_join_lock",
    ],
    "message_service.py": [
        "list_messages",
        "send_message",
        "mute_member",
        "unmute_member",
    ],
    "admin_service.py": [
        "admin_list_sessions",
        "admin_delete_session",
        "admin_delete_sessions",
        "admin_list_analyses",
        "admin_list_messages",
        "admin_analyze_session",
        "admin_compare_analyze_sessions",
        "admin_add_member",
        "admin_remove_member",
        "admin_list_members",
        "list_classes",
        "admin_student_profile_analysis",
        "admin_cross_system_analysis",
    ],
    "prompts.py": [
        "_default_prompt",
        "_default_compare_prompt",
        "_student_profile_prompt",
        "_cross_system_prompt",
    ],
}

def read_file_content(filepath: str) -> str:
    """读取文件内容"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def write_file_content(filepath: str, content: str):
    """写入文件内容"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def backup_original_file():
    """备份原文件"""
    if os.path.exists(SOURCE_FILE):
        shutil.copy2(SOURCE_FILE, BACKUP_FILE)
        print(f"✅ 已备份原文件到: {BACKUP_FILE}")
        return True
    else:
        print(f"❌ 源文件不存在: {SOURCE_FILE}")
        return False

def extract_imports_and_constants(content: str) -> Tuple[str, str, Dict[str, str]]:
    """提取导入语句、常量和函数定义"""
    lines = content.split('\n')

    imports = []
    constants = []
    functions = {}
    current_function = None
    function_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # 跳过空行
        if not stripped:
            i += 1
            continue

        # 提取导入语句
        if stripped.startswith(('import ', 'from ')):
            imports.append(line)
            i += 1
            continue

        # 提取常量（全局变量和正则表达式）
        if stripped.startswith('_') and '=' in stripped and 'def ' not in stripped:
            constants.append(line)
            i += 1
            continue

        # 提取函数定义
        match = re.match(r'^(async\s+)?def\s+(\w+)\s*\(', stripped)
        if match:
            if current_function:
                functions[current_function] = '\n'.join(function_lines)

            current_function = match.group(2)
            function_lines = [line]
            i += 1
            continue

        # 收集函数体
        if current_function:
            function_lines.append(line)

        i += 1

    # 添加最后一个函数
    if current_function and function_lines:
        functions[current_function] = '\n'.join(function_lines)

    return '\n'.join(imports), '\n'.join(constants), functions

def create_module_file(module_name: str, imports: str, constants: str, functions: Dict[str, str]):
    """创建模块文件"""
    target_file = os.path.join(TARGET_DIR, module_name)

    content_parts = []

    # 添加文件头注释
    content_parts.append(f'"""\n{module_name.replace(".py", "").replace("_", " ").title()} 模块\n"""\n')

    # 添加导入语句
    if imports:
        content_parts.append(imports)
        content_parts.append('')  # 空行

    # 添加常量
    if constants and module_name == "core.py":
        content_parts.append(constants)
        content_parts.append('')  # 空行

    # 添加函数
    module_functions = FUNCTION_CATEGORIES.get(module_name, [])
    for func_name in module_functions:
        if func_name in functions:
            content_parts.append(functions[func_name])
            content_parts.append('')  # 函数间空行
        else:
            print(f"⚠️  警告: 函数 {func_name} 未找到")

    # 写入文件
    write_file_content(target_file, '\n'.join(content_parts))
    print(f"📄 创建文件: {target_file}")

def create_init_file():
    """创建 __init__.py 文件"""
    init_content = '''"""
Group Discussion 模块

拆分自原 group_discussion.py 文件，按功能模块组织。
"""

from .core import *
from .session_service import *
from .message_service import *
from .admin_service import *
from .prompts import *

__all__ = [
    # core.py
    "_gd_key",
    "_gd_metric_incr",
    "_normalize_group_no",
    "_normalize_class_name",
    "_normalize_group_name",
    "_display_name",
    "resolve_target_class_name",

    # session_service.py
    "get_or_create_today_session",
    "ensure_session_view_access",
    "list_today_groups",
    "set_group_name",
    "enforce_join_lock",
    "set_join_lock",

    # message_service.py
    "list_messages",
    "send_message",
    "mute_member",
    "unmute_member",

    # admin_service.py
    "admin_list_sessions",
    "admin_delete_session",
    "admin_delete_sessions",
    "admin_list_analyses",
    "admin_list_messages",
    "admin_analyze_session",
    "admin_compare_analyze_sessions",
    "admin_add_member",
    "admin_remove_member",
    "admin_list_members",
    "list_classes",
    "admin_student_profile_analysis",
    "admin_cross_system_analysis",

    # prompts.py
    "_default_prompt",
    "_default_compare_prompt",
    "_student_profile_prompt",
    "_cross_system_prompt",
]
'''

    init_file = os.path.join(TARGET_DIR, "__init__.py")
    write_file_content(init_file, init_content)
    print(f"📄 创建文件: {init_file}")

def create_redirect_file():
    """创建重定向文件（保持向后兼容）"""
    redirect_content = '''"""
重定向文件，保持向后兼容

新代码请直接导入具体模块:
from app.services.agents.group_discussion.session_service import get_or_create_today_session
"""

import warnings
warnings.warn(
    "直接导入 group_discussion 已过时，请导入具体子模块",
    DeprecationWarning,
    stacklevel=2
)

# 重定向到新模块
from app.services.agents.group_discussion import *
'''

    write_file_content(SOURCE_FILE, redirect_content)
    print(f"📄 创建重定向文件: {SOURCE_FILE}")

def find_import_references():
    """查找所有导入 group_discussion 的文件"""
    print("\n🔍 查找导入引用...")

    # 在 backend 目录中查找
    import_patterns = [
        'from app.services.agents.group_discussion import',
        'import app.services.agents.group_discussion',
        'from app.services.agents import group_discussion',
    ]

    for root, dirs, files in os.walk('backend'):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    for pattern in import_patterns:
                        if pattern in content:
                            print(f"  发现引用: {filepath}")
                            break
                except:
                    continue

    print("\n📝 需要手动更新以上文件的导入语句")

def run_tests():
    """运行相关测试"""
    print("\n🧪 运行测试验证...")

    test_commands = [
        "cd backend && pytest tests/group_discussion/ -v",
        "cd backend && pytest tests/ -k group_discussion -v",
    ]

    for cmd in test_commands:
        print(f"\n执行: {cmd}")
        os.system(cmd)

def main():
    print("🔧 group_discussion.py 精确拆分脚本 V2")
    print("=" * 60)

    # 1. 备份原文件
    if not backup_original_file():
        return

    # 2. 读取并分析原文件
    print("\n📊 分析原文件...")
    content = read_file_content(SOURCE_FILE)
    imports, constants, functions = extract_imports_and_constants(content)

    print(f"  导入语句行数: {len(imports.split('\\n'))}")
    print(f"  常量行数: {len(constants.split('\\n'))}")
    print(f"  函数数量: {len(functions)}")

    # 3. 创建目标目录
    os.makedirs(TARGET_DIR, exist_ok=True)
    print(f"\n📁 创建目录: {TARGET_DIR}")

    # 4. 创建各模块文件
    print("\n📄 创建模块文件...")
    for module_name in FUNCTION_CATEGORIES.keys():
        create_module_file(module_name, imports, constants, functions)

    # 5. 创建 __init__.py
    create_init_file()

    # 6. 创建重定向文件
    create_redirect_file()

    # 7. 查找导入引用
    find_import_references()

    # 8. 运行测试验证
    run_tests()

    print("\n" + "=" * 60)
    print("✅ 拆分完成!")
    print("\n📋 下一步操作:")
    print("1. 仔细检查新文件结构")
    print("2. 运行完整测试套件")
    print("3. 手动测试关键API端点")
    print("4. 更新其他文件的导入语句")
    print("5. 提交代码变更")

    # 显示新文件结构
    print("\n📁 新文件结构:")
    for root, dirs, files in os.walk(TARGET_DIR):
        level = root.replace(TARGET_DIR, '').count(os.sep)
        indent = ' ' * 2 * level
        print(f'{indent}{os.path.basename(root)}/')
        subindent = ' ' * 2 * (level + 1)
        for file in sorted(files):
            # 显示文件大小
            filepath = os.path.join(root, file)
            size = os.path.getsize(filepath)
            print(f'{subindent}{file} ({size} bytes)')

if __name__ == "__main__":
    main()