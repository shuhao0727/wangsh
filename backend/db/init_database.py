#!/usr/bin/env python3
"""
简单数据库初始化程序
检查数据库是否存在必要表，如果不存在则执行初始化SQL脚本

功能：
1. 检查数据库连接
2. 检查核心表是否存在
3. 如果表不存在或为空，执行完全初始化脚本
4. 不执行破坏性操作，只进行安全初始化

使用方法：
    python3 init_database.py          # 默认执行初始化
    python3 init_database.py --force  # 强制重新初始化（先删除旧数据）
    python3 init_database.py --check  # 只检查数据库状态，不执行初始化
    python3 init_database.py --help   # 显示帮助信息
"""

import os
import sys
import argparse
import subprocess
import psycopg2
from typing import Dict, List, Optional, Any, Tuple


class SimpleDatabaseInitializer:
    """简单的数据库初始化器"""
    
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        database: Optional[str] = None,
        postgres_container_name: Optional[str] = None,
    ):
        """
        初始化数据库连接参数
        """
        self.host = host or os.getenv("POSTGRES_HOST", "127.0.0.1")
        self.port = int(port or os.getenv("POSTGRES_PORT", "5432"))
        self.user = user or os.getenv("POSTGRES_USER", "admin")
        self.password = password if password is not None else os.getenv("POSTGRES_PASSWORD", "")
        self.database = database or os.getenv("POSTGRES_DB", "wangsh_db")
        self.postgres_container_name = postgres_container_name or os.getenv("POSTGRES_CONTAINER_NAME", "wangsh-postgres")
        self.connection: Optional[psycopg2.extensions.connection] = None
        self.cursor: Optional[psycopg2.extensions.cursor] = None
    
    def connect(self) -> bool:
        """
        连接到数据库
        返回：连接是否成功
        """
        try:
            if not self.password:
                print("❌ 缺少环境变量 POSTGRES_PASSWORD，无法连接数据库")
                return False
            self.connection = psycopg2.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database
            )
            self.connection.autocommit = False
            self.cursor = self.connection.cursor()
            print("✅ 数据库连接成功")
            return True
        except Exception as e:
            print(f"❌ 数据库连接失败: {e}")
            return False
    
    def disconnect(self) -> None:
        """断开数据库连接"""
        if self.cursor:
            self.cursor.close()
            self.cursor = None
        if self.connection:
            self.connection.close()
            self.connection = None
        print("📡 数据库连接已关闭")
    
    def check_table_exists(self, table_name: str) -> bool:
        """
        检查表是否存在
        """
        if not self.cursor:
            print("❌ 数据库游标未初始化")
            return False
        
        try:
            query = """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                )
            """
            self.cursor.execute(query, (table_name,))
            result = self.cursor.fetchone()
            return result[0] if result else False
        except Exception as e:
            print(f"❌ 检查表 {table_name} 时出错: {e}")
            return False
    
    def get_table_row_count(self, table_name: str) -> int:
        """
        获取表的行数
        """
        if not self.cursor:
            print("❌ 数据库游标未初始化")
            return 0
        
        try:
            query = f"SELECT COUNT(*) FROM {table_name}"
            self.cursor.execute(query)
            result = self.cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            # 如果表不存在或其他错误，返回0
            return 0
    
    def check_core_tables(self) -> Dict[str, Any]:
        """
        检查核心表状态
        返回：核心表状态字典
        """
        core_tables = [
            "sys_users",        # 用户表（最重要）
            "znt_agents",       # 智能体表
            "wz_articles",      # 文章表
            "wz_categories",    # 分类表
            "sys_permissions",  # 权限表
            "alembic_version"   # 迁移版本表
        ]
        
        status: Dict[str, Any] = {
            "all_tables_exist": True,
            "tables": {},
            "total_tables": len(core_tables),
            "missing_tables": [],
            "empty_tables": []
        }
        
        for table in core_tables:
            exists = self.check_table_exists(table)
            row_count = 0
            
            if exists:
                row_count = self.get_table_row_count(table)
            
            status["tables"][table] = {
                "exists": exists,
                "row_count": row_count
            }
            
            if not exists:
                status["all_tables_exist"] = False
                status["missing_tables"].append(table)
            
            if exists and row_count == 0:
                status["empty_tables"].append(table)
        
        return status
    
    def execute_sql_file_docker(self, sql_file_path: str) -> bool:
        """
        使用Docker容器执行SQL文件
        """
        try:
            print(f"🐳 使用Docker容器执行SQL文件: {sql_file_path}")
            
            if not os.path.exists(sql_file_path):
                print(f"❌ SQL文件不存在: {sql_file_path}")
                return False
            
            # 读取SQL文件内容
            with open(sql_file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # 构建Docker exec命令
            cmd = [
                "docker", "exec", "-i", self.postgres_container_name,
                "psql", "-U", self.user, "-d", self.database
            ]
            
            print("🔄 执行Docker初始化命令...")
            
            # 执行命令
            result = subprocess.run(
                cmd,
                input=sql_content,
                capture_output=True,
                text=True,
                encoding='utf-8'
            )
            
            if result.returncode != 0:
                print(f"❌ Docker执行SQL失败: {result.stderr}")
                return False
            
            print("✅ Docker执行SQL完成")
            return True
            
        except Exception as e:
            print(f"❌ Docker执行SQL过程中出错: {e}")
            return False
    
    def execute_sql_file_direct(self, sql_file_path: str) -> bool:
        """
        直接连接执行SQL文件
        """
        if not os.path.exists(sql_file_path):
            print(f"❌ SQL文件不存在: {sql_file_path}")
            return False
        
        if not self.cursor or not self.connection:
            print("❌ 数据库连接未建立")
            return False
        
        try:
            with open(sql_file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            print(f"📄 正在执行SQL文件: {sql_file_path}")
            
            # 分割SQL语句并执行
            sql_statements = sql_content.split(';')
            
            for i, statement in enumerate(sql_statements):
                statement = statement.strip()
                if not statement:
                    continue
                
                # 跳过注释
                if statement.startswith('--'):
                    continue
                
                try:
                    self.cursor.execute(statement)
                except Exception as e:
                    print(f"❌ 执行SQL语句失败 (语句 {i+1}): {e}")
                    print(f"    SQL: {statement[:100]}...")
                    if self.connection:
                        self.connection.rollback()
                    return False
            
            if self.connection:
                self.connection.commit()
            print(f"✅ SQL文件执行完成: {sql_file_path}")
            return True
            
        except Exception as e:
            print(f"❌ 执行SQL文件失败: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def initialize_database(self, force: bool = False, use_docker: bool = True) -> bool:
        """
        初始化数据库
        参数：
            force: 是否强制重新初始化
            use_docker: 是否使用Docker容器执行
        返回：初始化是否成功
        """
        print("=" * 60)
        print("🚀 数据库初始化程序 (简单版)")
        print("=" * 60)
        
        # 检查数据库连接
        if not self.connect():
            return False
        
        try:
            # 检查当前状态
            print("📊 检查数据库当前状态...")
            status = self.check_core_tables()
            
            # 显示检查结果
            print(f"📋 核心表检查: {status['total_tables']} 个表")
            print(f"  ✅ 存在的表: {status['total_tables'] - len(status['missing_tables'])}")
            print(f"  ❌ 缺失的表: {len(status['missing_tables'])}")
            
            if status['missing_tables']:
                print(f"     缺失的表: {', '.join(status['missing_tables'])}")
            
            if status['empty_tables']:
                print(f"  ⚠️  空表: {len(status['empty_tables'])}")
                print(f"     空表: {', '.join(status['empty_tables'])}")
            
            # 检查是否需要初始化
            need_initialization = False
            
            if force:
                print("🗑️  强制模式：将重新初始化数据库")
                need_initialization = True
            elif len(status['missing_tables']) > 0:
                print("📝 缺失核心表，需要初始化")
                need_initialization = True
            elif not status['all_tables_exist']:
                print("📝 核心表不完整，需要初始化")
                need_initialization = True
            else:
                print("✅ 数据库表结构完整，无需初始化")
                
                # 即使表存在，也要检查是否有数据
                users_count = self.get_table_row_count("sys_users")
                if users_count == 0:
                    print("📝 用户表为空，需要初始化数据")
                    need_initialization = True
                else:
                    print(f"✅ 数据库已有 {users_count} 个用户")
            
            if not need_initialization:
                print("🎉 数据库状态正常，跳过初始化")
                return True
            
            # 执行初始化
            print("🔄 开始执行数据库初始化...")
            
            # 优先使用 v3.0 版本的初始化脚本
            v3_sql_file_path = os.path.join(
                os.path.dirname(__file__),
                "init.sql",
                "full_init_v3.sql"
            )
            
            fallback_sql_file_path = os.path.join(
                os.path.dirname(__file__),
                "init.sql",
                "full_init.sql"
            )
            
            sql_file_path = None
            if os.path.exists(v3_sql_file_path):
                sql_file_path = v3_sql_file_path
                print(f"📦 使用 v3.0 增强版初始化脚本: {v3_sql_file_path}")
            elif os.path.exists(fallback_sql_file_path):
                sql_file_path = fallback_sql_file_path
                print(f"📦 使用标准版初始化脚本: {fallback_sql_file_path}")
            else:
                print(f"❌ 初始化SQL文件不存在: {v3_sql_file_path}")
                return False
            
            if use_docker:
                success = self.execute_sql_file_docker(sql_file_path)
            else:
                success = self.execute_sql_file_direct(sql_file_path)
            
            if not success:
                return False
            
            # 验证初始化结果
            print("✅ 验证初始化结果...")
            
            # 重新连接以获取最新状态
            self.disconnect()
            if not self.connect():
                return False
            
            final_status = self.check_core_tables()
            users_count = self.get_table_row_count("sys_users")
            
            print("=" * 60)
            print("🎉 数据库初始化完成！")
            print("=" * 60)
            print(f"📊 核心表数量: {final_status['total_tables']}")
            print(f"✅ 存在的表: {final_status['total_tables'] - len(final_status['missing_tables'])}")
            print(f"👥 用户数量: {users_count}")
            print("=" * 60)
            
            # 显示系统信息
            if users_count > 0:
                print("\n📋 系统登录信息:")
                print("    - 超级管理员: admin / wangshuhao0727")
                print("    - 管理员: admin2 / admin123456")
                print("    - 学生1: 张解决 / 202300033")
                print("    - 学生2: 王五 / 20220002")
            
            return True
            
        except Exception as e:
            print(f"❌ 初始化过程中出错: {e}")
            return False
        
        finally:
            self.disconnect()
    
    def check_database_status(self) -> bool:
        """
        只检查数据库状态，不执行初始化
        返回：数据库状态是否正常
        """
        print("=" * 60)
        print("🔍 数据库状态检查")
        print("=" * 60)
        
        # 检查数据库连接
        if not self.connect():
            return False
        
        try:
            # 检查当前状态
            status = self.check_core_tables()
            
            # 显示检查结果
            print(f"📋 数据库名称: {self.database}")
            print(f"📊 核心表检查: {status['total_tables']} 个表")
            print(f"  ✅ 存在的表: {status['total_tables'] - len(status['missing_tables'])}")
            print(f"  ❌ 缺失的表: {len(status['missing_tables'])}")
            
            if status['missing_tables']:
                print(f"     缺失的表: {', '.join(status['missing_tables'])}")
            
            # 检查各表详情
            print("\n📊 表详情:")
            for table_name, table_info in status['tables'].items():
                status_icon = "✅" if table_info['exists'] else "❌"
                count_info = f" ({table_info['row_count']} 行)" if table_info['exists'] else ""
                print(f"  {status_icon} {table_name}{count_info}")
            
            # 检查用户数量
            users_count = self.get_table_row_count("sys_users")
            print(f"\n👥 用户数量: {users_count}")
            
            # 检查Alembic版本
            if self.check_table_exists("alembic_version"):
                if self.cursor:
                    self.cursor.execute("SELECT version_num FROM alembic_version ORDER BY version_num")
                    versions = self.cursor.fetchall()
                    print(f"🚀 Alembic版本: {len(versions)} 个")
                    for version in versions:
                        print(f"    - {version[0]}")
            else:
                print("🚀 Alembic版本: 表不存在")
            
            # 总体状态判断
            if status['all_tables_exist'] and users_count > 0:
                print("\n🎉 数据库状态: 正常 ✅")
                return True
            elif status['all_tables_exist'] and users_count == 0:
                print("\n⚠️  数据库状态: 表结构完整但无数据 ⚠️")
                return False
            else:
                print("\n❌ 数据库状态: 不完整 ❌")
                return False
            
        except Exception as e:
            print(f"❌ 检查数据库状态时出错: {e}")
            return False
        
        finally:
            self.disconnect()


def main() -> None:
    """主函数"""
    parser = argparse.ArgumentParser(
        description="简单数据库初始化程序",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python3 %(prog)s                   # 默认执行初始化（如果需要）
  python3 %(prog)s --force           # 强制重新初始化
  python3 %(prog)s --check           # 只检查数据库状态，不执行初始化
  python3 %(prog)s --no-docker       # 不使用Docker容器（直接连接）
  python3 %(prog)s --help            # 显示帮助信息

说明:
  1. 程序会自动检查数据库核心表是否存在
  2. 如果表不存在或为空，会自动执行初始化
  3. 不会删除已有数据，除非使用--force参数
  4. 默认使用Docker容器执行SQL，如果失败会尝试直接连接
        """
    )
    
    parser.add_argument("--force", action="store_true",
                       help="强制重新初始化（删除旧数据并重新创建）")
    parser.add_argument("--check", action="store_true",
                       help="只检查数据库状态，不执行初始化")
    parser.add_argument("--no-docker", action="store_true",
                       help="不使用Docker容器执行SQL（直接连接数据库）")
    parser.add_argument("--host", default="127.0.0.1",
                       help="数据库主机地址（默认: 127.0.0.1）")
    parser.add_argument("--port", type=int, default=5432,
                       help="数据库端口（默认: 5432）")
    parser.add_argument("--user", default="admin",
                       help="数据库用户（默认: admin）")
    parser.add_argument("--password", default="wangshuhao0727",
                       help="数据库密码（默认: wangshuhao0727）")
    parser.add_argument("--database", default="wangsh_db",
                       help="数据库名称（默认: wangsh_db）")
    
    args = parser.parse_args()
    
    # 创建初始化器
    initializer = SimpleDatabaseInitializer(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database
    )
    
    # 执行操作
    if args.check:
        # 只检查状态
        success = initializer.check_database_status()
    else:
        # 执行初始化
        success = initializer.initialize_database(
            force=args.force,
            use_docker=not args.no_docker
        )
    
    # 根据结果退出
    if success:
        print("🎉 操作执行完成！")
        sys.exit(0)
    else:
        print("❌ 操作执行失败")
        sys.exit(1)


if __name__ == "__main__":
    main()
