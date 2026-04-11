#!/usr/bin/env python3
"""
数据库性能分析工具

分析当前数据库模型的索引情况，识别可能的性能瓶颈，
并提供优化建议。
"""

import ast
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any


class DatabasePerformanceAnalyzer:
    """数据库性能分析器"""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.models_dir = self.project_root / "app" / "models"
        self.index_patterns = {
            'primary_key': r'primary_key\s*=\s*True',
            'index': r'index\s*=\s*True',
            'unique': r'unique\s*=\s*True',
            'foreign_key': r'ForeignKey\(',
        }

    def find_model_files(self) -> List[Path]:
        """查找所有模型文件"""
        model_files = []
        for root, dirs, files in os.walk(self.models_dir):
            # 排除venv目录
            if 'venv' in root:
                continue
            for file in files:
                if file.endswith('.py') and file != '__init__.py':
                    model_files.append(Path(root) / file)
        return model_files

    def analyze_model_file(self, file_path: Path) -> Dict[str, Any]:
        """分析单个模型文件"""
        result = {
            'file': str(file_path.relative_to(self.project_root)),
            'tables': [],
            'total_columns': 0,
            'indexed_columns': 0,
            'foreign_keys': 0,
            'issues': []
        }

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 解析Python文件
            tree = ast.parse(content)

            # 查找类定义
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    class_info = self._analyze_class(node, content)
                    if class_info:
                        result['tables'].append(class_info)
                        result['total_columns'] += class_info['total_columns']
                        result['indexed_columns'] += class_info['indexed_columns']
                        result['foreign_keys'] += class_info['foreign_keys']

                        # 收集问题
                        for issue in class_info.get('issues', []):
                            result['issues'].append({
                                'table': class_info['name'],
                                'issue': issue
                            })

        except Exception as e:
            result['issues'].append({
                'table': 'file_parse_error',
                'issue': f'解析文件时出错: {e}'
            })

        return result

    def _analyze_class(self, class_node: ast.ClassDef, file_content: str) -> Dict[str, Any]:
        """分析单个类定义"""
        class_info = {
            'name': class_node.name,
            'table_name': None,
            'columns': [],
            'total_columns': 0,
            'indexed_columns': 0,
            'foreign_keys': 0,
            'issues': []
        }

        # 查找 __tablename__
        for node in class_node.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == '__tablename__':
                        if isinstance(node.value, ast.Constant):
                            class_info['table_name'] = node.value.value

        # 如果没有找到表名，跳过非模型类
        if not class_info['table_name']:
            return None

        # 分析类中的列定义
        for node in class_node.body:
            if isinstance(node, ast.AnnAssign):
                # 类型注解赋值，如: id = Column(Integer, primary_key=True)
                column_info = self._analyze_column(node, file_content)
                if column_info:
                    class_info['columns'].append(column_info)
                    class_info['total_columns'] += 1

                    if column_info.get('is_indexed'):
                        class_info['indexed_columns'] += 1

                    if column_info.get('is_foreign_key'):
                        class_info['foreign_keys'] += 1

                    # 检查潜在问题
                    if column_info.get('potential_issues'):
                        for issue in column_info['potential_issues']:
                            class_info['issues'].append(f"列 '{column_info['name']}': {issue}")

        return class_info

    def _analyze_column(self, node: ast.AnnAssign, file_content: str) -> Dict[str, Any]:
        """分析单个列定义"""
        if not isinstance(node.target, ast.Name):
            return None

        column_name = node.target.id
        column_info = {
            'name': column_name,
            'is_indexed': False,
            'is_primary_key': False,
            'is_unique': False,
            'is_foreign_key': False,
            'potential_issues': []
        }

        # 获取列定义的源代码
        line_start = node.lineno - 1
        lines = file_content.split('\n')
        column_line = lines[line_start] if line_start < len(lines) else ''

        # 检查列属性
        if 'primary_key=True' in column_line:
            column_info['is_primary_key'] = True
            column_info['is_indexed'] = True  # 主键自动创建索引

        if 'index=True' in column_line:
            column_info['is_indexed'] = True

        if 'unique=True' in column_line:
            column_info['is_unique'] = True
            column_info['is_indexed'] = True  # 唯一约束自动创建索引

        if 'ForeignKey(' in column_line:
            column_info['is_foreign_key'] = True

            # 外键列通常应该被索引
            if not column_info['is_indexed']:
                column_info['potential_issues'].append('外键列未被索引，可能导致连接查询性能问题')

        # 检查常见查询字段
        common_query_fields = ['created_at', 'updated_at', 'status', 'type', 'user_id', 'category_id']
        if column_name in common_query_fields and not column_info['is_indexed']:
            column_info['potential_issues'].append(f"常用查询字段 '{column_name}' 未被索引")

        # 检查布尔字段
        if 'Boolean' in column_line and column_name.startswith('is_'):
            column_info['potential_issues'].append(f"布尔字段 '{column_name}' 选择性较低，索引效果可能不佳")

        return column_info

    def generate_report(self) -> str:
        """生成性能分析报告"""
        model_files = self.find_model_files()

        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("数据库性能分析报告")
        report_lines.append("=" * 80)
        report_lines.append(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"分析文件数: {len(model_files)}")
        report_lines.append("")

        total_tables = 0
        total_columns = 0
        total_indexed = 0
        total_foreign_keys = 0
        all_issues = []

        for model_file in model_files:
            analysis = self.analyze_model_file(model_file)

            if not analysis['tables']:
                continue

            report_lines.append(f"文件: {analysis['file']}")

            for table in analysis['tables']:
                total_tables += 1
                total_columns += table['total_columns']
                total_indexed += table['indexed_columns']
                total_foreign_keys += table['foreign_keys']

                report_lines.append(f"  表: {table['name']} ({table['table_name']})")
                report_lines.append(f"    列数: {table['total_columns']}, 索引列: {table['indexed_columns']}, 外键: {table['foreign_keys']}")

                # 计算索引覆盖率
                if table['total_columns'] > 0:
                    coverage = (table['indexed_columns'] / table['total_columns']) * 100
                    report_lines.append(f"    索引覆盖率: {coverage:.1f}%")

                # 显示问题
                if table['issues']:
                    for issue in table['issues']:
                        all_issues.append(f"{table['name']}: {issue}")
                        report_lines.append(f"    ⚠️  {issue}")

                report_lines.append("")

        # 汇总统计
        report_lines.append("=" * 80)
        report_lines.append("汇总统计")
        report_lines.append("=" * 80)
        report_lines.append(f"总表数: {total_tables}")
        report_lines.append(f"总列数: {total_columns}")
        report_lines.append(f"索引列数: {total_indexed}")
        report_lines.append(f"外键数: {total_foreign_keys}")

        if total_columns > 0:
            overall_coverage = (total_indexed / total_columns) * 100
            report_lines.append(f"总体索引覆盖率: {overall_coverage:.1f}%")

        # 显示所有问题
        if all_issues:
            report_lines.append("")
            report_lines.append("=" * 80)
            report_lines.append("发现的问题")
            report_lines.append("=" * 80)
            for i, issue in enumerate(all_issues, 1):
                report_lines.append(f"{i}. {issue}")

        # 优化建议
        report_lines.append("")
        report_lines.append("=" * 80)
        report_lines.append("优化建议")
        report_lines.append("=" * 80)

        if overall_coverage < 30:
            report_lines.append("1. ⚠️ 索引覆盖率较低，建议为常用查询字段添加索引")

        if total_foreign_keys > 0:
            report_lines.append("2. 确保所有外键列都有索引，以优化连接查询性能")

        report_lines.append("3. 考虑为以下字段添加复合索引:")
        report_lines.append("   - 经常一起查询的字段组合")
        report_lines.append("   - 经常用于排序和分组的字段")
        report_lines.append("   - 高选择性的字段（如状态、类型等）")

        report_lines.append("4. 定期分析慢查询日志，识别性能瓶颈")
        report_lines.append("5. 考虑使用数据库监控工具（如pg_stat_statements）")

        return "\n".join(report_lines)


def main():
    """主函数"""
    import sys
    import os

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    print("开始数据库性能分析...")

    analyzer = DatabasePerformanceAnalyzer(project_root)
    report = analyzer.generate_report()

    # 输出报告
    print(report)

    # 保存报告到文件
    report_file = Path(project_root) / "db_performance_report.txt"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n报告已保存到: {report_file}")


if __name__ == "__main__":
    main()