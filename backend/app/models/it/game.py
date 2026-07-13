"""游戏资源库 — 数据模型

it_games: 游戏资源表
it_game_download_logs: 下载记录表
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from app.db.database import Base


class GameResource(Base):
    """游戏资源表 — 存储游戏安装包的元数据，实际文件存储在本地文件系统"""

    __tablename__ = "it_games"
    __table_args__ = {"comment": "游戏资源库表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False, comment="游戏名称")
    description = Column(Text, nullable=True, comment="游戏简介")
    category = Column(String(100), nullable=False, index=True, comment="分类：如益智、动作、模拟、工具")
    filename = Column(String(300), nullable=False, comment="原始文件名")
    stored_path = Column(String(500), nullable=False, comment="服务器存储路径")
    file_size = Column(Integer, nullable=False, default=0, comment="文件大小（字节）")
    file_mime = Column(String(100), nullable=False, default="application/octet-stream", comment="MIME 类型")
    file_sha256 = Column(String(64), nullable=True, comment="SHA256 校验值")
    icon_url = Column(String(500), nullable=True, comment="封面/图标 URL")
    download_count = Column(Integer, nullable=False, default=0, comment="下载次数（冗余计数）")
    is_active = Column(Boolean, nullable=False, default=True, comment="是否上架")
    uploaded_by = Column(
        Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True, index=True, comment="上传者"
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间"
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间"
    )


class GameDownloadLog(Base):
    """游戏下载记录表 — 记录每次下载的用户和时间"""

    __tablename__ = "it_game_download_logs"
    __table_args__ = {"comment": "游戏下载记录表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("it_games.id", ondelete="CASCADE"), nullable=False, index=True, comment="游戏ID")
    user_id = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True, index=True, comment="下载用户")
    ip_address = Column(String(45), nullable=False, comment="客户端IP")
    user_agent = Column(String(500), nullable=True, comment="浏览器UA")
    downloaded_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="下载时间"
    )
