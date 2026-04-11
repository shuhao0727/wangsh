#!/usr/bin/env python3
"""
group_discussion.py 文件拆分脚本

这个脚本帮助将 app/services/agents/group_discussion.py 拆分为多个小文件。
执行前请备份原文件。
"""

import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

# 配置
SOURCE_FILE = "app/services/agents/group_discussion.py"
TARGET_DIR = "app/services/agents/group_discussion"
BACKUP_FILE = "app/services/agents/group_discussion.py.backup"

# 函数到文件的映射
FUNCTION_MAPPING = {
    "core.py": [
        "_gd_key",
        "_normalize_group_no",
        "_normalize_class_name",
        "_normalize_group_name",
        "_display_name",
        "_gd_metric_incr",
    ],
    "prompts.py": [
        "_default_prompt",
        "_default_compare_prompt",
        "_student_profile_prompt",
        "_cross_system_prompt",
    ],
    "session_service.py": [
        "resolve_target_class_name",
        "create_group_discussion_session",
        "get_group_discussion_session",
        "list_group_discussion_sessions",
        "delete_group_discussion_session",
    ],
    "analysis_service.py": [
        "analyze_group_discussion",
        "compare_group_discussions",
        "analyze_student_profile",
        "analyze_cross_system",
    ],
    "member_service.py": [
        "add_group_discussion_member",
        "remove_group_discussion_member",
        "list_group_discussion_members",
    ],
    "message_service.py": [
        "add_group_discussion_message",
        "list_group_discussion_messages",
        "delete_group_discussion_message",
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
    else:
        print(f"❌ 源文件不存在: {SOURCE_FILE}")
        exit(1)

def extract_imports(content: str) -> Tuple[str, str]:
    """提取导入语句和剩余内容"""
    lines = content.split('\n')
    imports = []
    other_lines = []

    in_import = False
    import_buffer = []

    for line in lines:
        stripped = line.strip()

        # 处理多行导入
        if in_import:
            import_buffer.append(line)
            if ')' in line or not line.endswith('\\'):
                imports.extend(import_buffer)
                import_buffer = []
                in_import = False
            continue

        # 检查是否是导入语句
        if stripped.startswith(('import ', 'from ')):
            if line.endswith('\\'):
                in_import = True
                import_buffer.append(line)
            else:
                imports.append(line)
        else:
            other_lines.append(line)

    return '\n'.join(imports), '\n'.join(other_lines)

def extract_functions(content: str) -> Dict[str, str]:
    """提取所有函数定义"""
    functions = {}
    lines = content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i]
        # 查找函数定义
        match = re.match(r'^(async\s+)?def\s+(\w+)\s*\(', line.strip())
        if match:
            func_name = match.group(2)
            func_lines = [line]

            # 收集函数体
            i += 1
            indent_level = len(line) - len(line.lstrip())

            while i < len(lines):
                current_line = lines[i]
                if current_line.strip() and len(current_line) - len(current_line.lstrip()) <= indent_level:
                    # 回到相同或更少的缩进，函数结束
                    break
                func_lines.append(current_line)
                i += 1

            functions[func_name] = '\n'.join(func_lines)
        else:
            i += 1

    return functions

def create_init_file(target_dir: str):
    """创建 __init__.py 文件"""
    init_content = '''"""
Group Discussion 模块

拆分自原 group_discussion.py 文件，按功能模块组织。
"""

from .core import *
from .prompts import *
from .session_service import *
from .analysis_service import *
from .member_service import *
from .message_service import *

__all__ = [
    # core.py
    "_gd_key",
    "_normalize_group_no",
    "_normalize_class_name",
    "_normalize_group_name",
    "_display_name",
    "_gd_metric_incr",

    # prompts.py
    "_default_prompt",
    "_default_compare_prompt",
    "_student_profile_prompt",
    "_cross_system_prompt",

    # session_service.py
    "resolve_target_class_name",
    "create_group_discussion_session",
    "get_group_discussion_session",
    "list_group_discussion_sessions",
    "delete_group_discussion_session",

    # analysis_service.py
    "analyze_group_discussion",
    "compare_group_discussions",
    "analyze_student_profile",
    "analyze_cross_system",

    # member_service.py
    "add_group_discussion_member",
    "remove_group_discussion_member",
    "list_group_discussion_members",

    # message_service.py
    "add_group_discussion_message",
    "list_group_discussion_messages",
    "delete_group_discussion_message",
]
'''
    write_file_content(os.path.join(target_dir, "__init__.py"), init_content)

def create_core_file(target_dir: str, imports: str, functions: Dict[str, str]):
    """创建 core.py 文件"""
    core_functions = FUNCTION_MAPPING["core.py"]
    core_content = imports + "\n\n"

    for func_name in core_functions:
        if func_name in functions:
            core_content += functions[func_name] + "\n\n"
        else:
            print(f"⚠️  警告: 函数 {func_name} 未找到")

    write_file_content(os.path.join(target_dir, "core.py"), core_content)

def create_prompts_file(target_dir: str, imports: str, functions: Dict[str, str]):
    """创建 prompts.py 文件"""
    prompt_functions = FUNCTION_MAPPING["prompts.py"]
    prompt_content = imports + "\n\n"

    for func_name in prompt_functions:
        if func_name in functions:
            prompt_content += functions[func_name] + "\n\n"
        else:
            print(f"⚠️  警告: 函数 {func_name} 未找到")

    write_file_content(os.path.join(target_dir, "prompts.py"), prompt_content)

def create_service_file(target_dir: str, filename: str, imports: str, functions: Dict[str, str]):
    """创建服务文件"""
    service_functions = FUNCTION_MAPPING.get(filename, [])
    if not service_functions:
        return

    service_content = imports + "\n\n"

    for func_name in service_functions:
        if func_name in functions:
            service_content += functions[func_name] + "\n\n"
        else:
            print(f"⚠️  警告: 函数 {func_name} 未找到")

    write_file_content(os.path.join(target_dir, filename), service_content)

def update_imports_in_other_files():
    """更新其他文件中的导入语句"""
    # 这里可以添加更新其他文件导入的逻辑
    # 例如：查找所有导入 group_discussion 的文件并更新
    print("📝 提示: 请手动更新其他文件中的导入语句")
    print("  原导入: from app.services.agents.group_discussion import ...")
    print("  新导入: from app.services.agents.group_discussion import ...  # 自动重定向")
    print("  或: from app.services.agents.group_discussion.session_service import ...")

def main():
    print("🔧 开始拆分 group_discussion.py 文件")
    print("=" * 50)

    # 1. 备份原文件
    backup_original_file()

    # 2. 读取文件内容
    content = read_file_content(SOURCE_FILE)

    # 3. 提取导入和函数
    imports, remaining = extract_imports(content)
    functions = extract_functions(remaining)

    print(f"📊 统计信息:")
    print(f"  - 总函数数: {len(functions)}")
    print(f"  - 已映射函数: {sum(len(v) for v in FUNCTION_MAPPING.values())}")

    # 4. 创建目标目录
    os.makedirs(TARGET_DIR, exist_ok=True)

    # 5. 创建各模块文件
    create_init_file(TARGET_DIR)
    create_core_file(TARGET_DIR, imports, functions)
    create_prompts_file(TARGET_DIR, imports, functions)

    for service_file in ["session_service.py", "analysis_service.py",
                         "member_service.py", "message_service.py"]:
        create_service_file(TARGET_DIR, service_file, imports, functions)

    # 6. 创建重定向文件（可选）
    redirect_content = '''"""
重定向文件，保持向后兼容

新代码请直接导入具体模块:
from app.services.agents.group_discussion.session_service import create_group_discussion_session
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

    print("\n✅ 文件拆分完成!")
    print("=" * 50)
    print("📁 新文件结构:")
    for root, dirs, files in os.walk(TARGET_DIR):
        level = root.replace(TARGET_DIR, '').count(os.sep)
        indent = ' ' * 2 * level
        print(f'{indent}{os.path.basename(root)}/')
        subindent = ' ' * 2 * (level + 1)
        for file in files:
            print(f'{subindent}{file}')

    print("\n📋 下一步:")
    print("1. 运行测试: pytest tests/ -k group_discussion")
    print("2. 手动测试相关API端点")
    print("3. 更新其他文件中的导入语句")
    print("4. 运行完整测试套件")

    # 7. 提示更新导入
    update_imports_in_other_files()

if __name__ == "__main__":
    main()