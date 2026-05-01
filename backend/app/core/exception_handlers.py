"""全局异常处理器 — 统一结构化错误响应与集中日志。"""

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from loguru import logger


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.opt(exception=True).error(
        "未捕获的服务器异常 | request_id={request_id} path={path}",
        request_id=request_id,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "服务器内部错误",
            "request_id": request_id,
        },
    )


async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.warning(
        "参数校验失败 | request_id={request_id} path={path} detail={detail}",
        request_id=request_id,
        path=request.url.path,
        detail=str(exc),
    )
    return JSONResponse(
        status_code=400,
        content={
            "detail": str(exc),
            "request_id": request_id,
        },
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.error(
        "数据库完整性冲突 | request_id={request_id} path={path}",
        request_id=request_id,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=409,
        content={
            "detail": "数据冲突，请检查后重试",
            "request_id": request_id,
        },
    )
