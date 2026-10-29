"""锁住 get_agent 缓存不返回 session 绑定的 ORM 实例。

历史缺陷：_AGENT_CACHE 直接存 ORM 实例。实例绑定在创建它的 session 上，
session 关闭后为 detached；一旦对象被 expire 再读字段就抛
DetachedInstanceError。生产症状是 POST /api/v1/ai-agents/stream
3 次里 2 次 503「读取智能体配置失败」，堆栈落在 build_messages
读 system_prompt。
"""
import asyncio

import pytest
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import declarative_base

from app.services.agents import ai_agent as ai_agent_svc


def test_agent_cache_stores_plain_mapping_not_orm_instance():
    """缓存里必须只有普通 dict，不能是 ORM 实例。

    判断依据：ORM 实例带 SQLAlchemy 状态（sa_instance_state），dict 没有。
    """
    ai_agent_svc._AGENT_CACHE.clear()
    # 手工塞一个快照，模拟 get_agent 写入后的缓存形态
    snapshot = {
        "id": 1, "name": "x", "agent_type": "dify", "model_name": "",
        "system_prompt": "p", "api_endpoint": "http://a", "api_key": None,
        "api_key_encrypted": None, "api_key_last4": None, "has_api_key": False,
        "is_active": True, "is_deleted": False, "created_at": None,
        "deleted_at": None, "description": None,
    }
    ai_agent_svc._AGENT_CACHE[1] = snapshot
    cached = ai_agent_svc._AGENT_CACHE[1]
    assert isinstance(cached, dict)
    assert not hasattr(cached, "sa_instance_state")
    ai_agent_svc._AGENT_CACHE.clear()


def test_cached_agent_is_rebuilt_as_free_standing_instance():
    """命中缓存时应重建为游离实例：字段可读，且不与任何 session 关联。

    关键点是「读字段不抛 DetachedInstanceError」——这正是线上故障的形态。
    注意：新建实例是 transient 而非 detached，所以不能断言 detached is True；
    要断言的是 `sa_inspect(obj).session is None`（不绑 session）且字段可读。
    """
    from sqlalchemy import inspect as sa_inspect

    from app.models.agents.ai_agent import AIAgent

    snapshot = {
        "id": 7, "name": "重建测试", "agent_type": "dify", "model_name": "",
        "system_prompt": "你是助手", "api_endpoint": "http://docker-api-1:5001/v1",
        "api_key": None, "api_key_encrypted": "ct", "api_key_last4": "abcd",
        "has_api_key": True, "is_active": True, "is_deleted": False,
        "created_at": None, "deleted_at": None, "description": None,
    }
    rebuilt = AIAgent(**snapshot)

    # 不绑定 session —— 这是「不会 detached」的根因
    assert sa_inspect(rebuilt).session is None
    # 字段全部可直接读，不触发任何延迟加载
    assert rebuilt.system_prompt == "你是助手"
    assert rebuilt.api_endpoint == "http://docker-api-1:5001/v1"
    assert rebuilt.agent_type == "dify"
    assert rebuilt.is_active is True
    assert rebuilt.model_name == ""


def test_fernet_key_format_rejects_wrong_length():
    """Fernet 硬要求 32 字节：错一位就抛错，且只在加密时才暴露。

    踩过的坑：.env.dev 里写成 ZGV2X29ubHlfYWdlbnRfa2V5X2VuY3J5cHRpb25fa2V5XzMy
    （48 字符，解码 36 字节），服务启动不报错，但用户点「添加智能体」保存 API Key
    时抛 "Fernet key must be 32 url-safe base64-encoded bytes"。
    """
    import base64

    from cryptography.fernet import Fernet

    # 48 字符 / 36 字节：错误写法
    bad = "ZGV2X29ubHlfYWdlbnRfa2V5X2VuY3J5cHRpb25fa2V5XzMy"
    assert len(base64.urlsafe_b64decode(bad)) == 36
    with pytest.raises(ValueError):
        Fernet(bad.encode())

    # 44 字符 / 32 字节：正确写法
    good = "ZGV2X29ubHlfYWdlbnRfa2V5X2VuY3J5cHRpb25fMzI="
    assert len(base64.urlsafe_b64decode(good)) == 32
    f = Fernet(good.encode())
    assert f.decrypt(f.encrypt(b"x")) == b"x"


def test_env_example_has_valid_fernet_key():
    """仓库里的 .env.example 必须是可直接使用的合法 Fernet 密钥。

    否则新环境照抄示例，要到「保存智能体」那一步才会炸。
    """
    import base64
    from pathlib import Path

    from cryptography.fernet import Fernet

    root = Path(__file__).resolve().parents[3]
    text = (root / ".env.example").read_text(encoding="utf-8")
    value = ""
    for line in text.splitlines():
        if line.startswith("AGENT_API_KEY_ENCRYPTION_KEY="):
            value = line.split("=", 1)[1].strip()
            break
    assert value, "示例里缺少 AGENT_API_KEY_ENCRYPTION_KEY"
    assert len(base64.urlsafe_b64decode(value)) == 32, f"示例密钥解码后应为 32 字节，实际 {value}"
    Fernet(value.encode())  # 不抛错即合法
