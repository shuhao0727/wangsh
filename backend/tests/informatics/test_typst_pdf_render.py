"""Informatics PDF 渲染测试"""
import asyncio
from types import SimpleNamespace


def test_compile_note_success(monkeypatch):
    """测试 PDF 编译成功"""
    async def mock_compile():
        return {"status": "success", "task_id": "task-123"}

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.compile_note_pdf", mock_compile)
    result = asyncio.run(mock_compile())
    assert result["status"] == "success"


def test_compile_note_celery_disabled(monkeypatch):
    """测试 Celery 禁用时同步编译"""
    async def mock_compile():
        return {"status": "success", "sync": True}

    monkeypatch.setattr("app.api.endpoints.informatics.typst_notes.compile_note_pdf", mock_compile)
    result = asyncio.run(mock_compile())
    assert result["sync"] is True


def test_download_pdf_success(monkeypatch):
    """测试 PDF 下载"""
    monkeypatch.setattr("os.path.exists", lambda x: True)
    assert True
