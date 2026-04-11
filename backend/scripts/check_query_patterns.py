#!/usr/bin/env python3
"""
查询模式分析工具

分析代码中的SQLAlchemy查询模式，识别潜在的性能问题。
"""

import ast
import os
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any


class QueryPatternAnalyzer:
    """查询模式分析器"""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.api_dir = self.project_root / "app" / "api"
        self.services_dir = self.project_root / "app" / "services"

        # 查询模式正则表达式
        self.patterns = {
            'select_without_options': r'select\([^)]*\)(?!\.options\()',
            'n_plus_one_pattern': r'for.*in.*:.*select\(\)',
            'offset_limit': r'\.offset\(.*\)\.limit\(',
            'select_all': r'select\(\*\)',
            'no_where_clause': r'select\([^)]*\)\.where\(\)',  # 空的where条件
            'multiple_queries_in_loop': r'for.*:.*await.*execute\(select\(\)\)',
        }

    def find_python_files(self) -> List[Path]:
        """查找所有Python文件"""
        python_files = []
        for root, dirs, files in os.walk(self.project_root):
            # 排除venv和测试目录
            if any(exclude in root for exclude in ['venv', '__pycache__', '.pytest_cache']):
                continue

            for file in files:
                if file.endswith('.py'):
                    python_files.append(Path(root) / file)
        return python_files

    def analyze_file(self, file_path: Path) -> Dict[str, Any]:
        """分析单个文件"""
        result = {
            'file': str(file_path.relative_to(self.project_root)),
            'issues': [],
            'query_count': 0,
            'optimized_queries': 0,
        }

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 简单的文本分析
            issues = self._analyze_text(content, file_path)
            result['issues'].extend(issues)

            # 统计查询数量
            result['query_count'] = content.count('select(') + content.count('execute(')

            # 统计优化查询数量
            result['optimized_queries'] = content.count('selectinload(') + content.count('joinedload(')

        except Exception as e:
            result['issues'].append(f'解析文件时出错: {e}')

        return result

    def _analyze_text(self, content: str, file_path: Path) -> List[str]:
        """分析文本内容"""
        issues = []
        lines = content.split('\n')

        for i, line in enumerate(lines, 1):
            line_stripped = line.strip()

            # 检查select查询
            if 'select(' in line_stripped:
                # 检查是否使用了options加载关联
                if 'select(' in line_stripped and 'options(' not in line_stripped:
                    # 但排除简单的ID查询
                    if not re.search(r'select\([^)]*\.id[^)]*\)', line_stripped):
                        issues.append(f"第{i}行: SELECT查询未使用options加载关联数据")

                # 检查是否使用了select(*)
                if 'select(*)' in line_stripped or 'select( * )' in line_stripped:
                    issues.append(f"第{i}行: 使用了SELECT *，建议只选择需要的字段")

            # 检查offset/limit分页
            if '.offset(' in line_stripped and '.limit(' in line_stripped:
                # 检查是否有order_by
                if '.order_by(' not in line_stripped:
                    issues.append(f"第{i}行: OFFSET/LIMIT分页缺少ORDER BY，可能导致结果不稳定")

            # 检查循环中的查询
            if 'for ' in line_stripped and 'select(' in line_stripped:
                # 简单的N+1模式检测
                issues.append(f"第{i}行: 循环中执行SELECT查询，可能导致N+1问题")

            # 检查批量操作
            if 'add_all(' in line_stripped:
                # 这是好的模式
                pass
            elif 'add(' in line_stripped and 'for ' in lines[i-2] if i > 1 else '':
                # 循环中单个add
                issues.append(f"第{i}行: 循环中单个add操作，建议使用add_all批量添加")

        return issues

    def generate_report(self) -> str:
        """生成分析报告"""
        python_files = self.find_python_files()

        # 只分析API和services目录
        target_files = [
            f for f in python_files
            if str(f).startswith(str(self.api_dir)) or str(f).startswith(str(self.services_dir))
        ]

        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("查询模式分析报告")
        report_lines.append("=" * 80)
        report_lines.append(f"分析文件数: {len(target_files)}")
        report_lines.append("")

        total_issues = 0
        total_queries = 0
        total_optimized = 0

        for file_path in target_files:
            analysis = self.analyze_file(file_path)

            if not analysis['issues'] and analysis['query_count'] == 0:
                continue

            report_lines.append(f"文件: {analysis['file']}")
            report_lines.append(f"  查询数量: {analysis['query_count']}")
            report_lines.append(f"  优化查询: {analysis['optimized_queries']}")

            if analysis['issues']:
                report_lines.append(f"  发现问题: {len(analysis['issues'])}")
                for issue in analysis['issues']:
                    report_lines.append(f"    ⚠️  {issue}")
                    total_issues += 1

            total_queries += analysis['query_count']
            total_optimized += analysis['optimized_queries']
            report_lines.append("")

        # 汇总统计
        report_lines.append("=" * 80)
        report_lines.append("汇总统计")
        report_lines.append("=" * 80)
        report_lines.append(f"总查询数: {total_queries}")
        report_lines.append(f"优化查询数: {total_optimized}")
        report_lines.append(f"发现问题数: {total_issues}")

        if total_queries > 0:
            optimization_rate = (total_optimized / total_queries) * 100
            report_lines.append(f"查询优化率: {optimization_rate:.1f}%")

        # 优化建议
        report_lines.append("")
        report_lines.append("=" * 80)
        report_lines.append("优化建议")
        report_lines.append("=" * 80)

        if total_issues > 0:
            report_lines.append("1. 修复发现的问题，特别是N+1查询和SELECT *")

        if total_queries > 0 and optimization_rate < 50:
            report_lines.append("2. 提高查询优化率，更多使用selectinload/joinedload")

        report_lines.append("3. 具体建议:")
        report_lines.append("   a. 为所有列表查询添加关联加载")
        report_lines.append("   b. 避免在循环中执行数据库查询")
        report_lines.append("   c. 使用批量操作替代单个操作")
        report_lines.append("   d. 只选择需要的字段，避免SELECT *")
        report_lines.append("   e. 为分页查询添加ORDER BY")

        return "\n".join(report_lines)


def main():
    """主函数"""
    import os

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    print("开始查询模式分析...")

    analyzer = QueryPatternAnalyzer(project_root)
    report = analyzer.generate_report()

    # 输出报告
    print(report)

    # 保存报告到文件
    report_file = Path(project_root) / "query_pattern_report.txt"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n报告已保存到: {report_file}")


if __name__ == "__main__":
    main()