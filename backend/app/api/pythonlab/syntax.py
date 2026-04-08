
import ast
import time
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

try:
    from pyflakes import api as pyflakes_api
    from pyflakes import reporter as pyflakes_reporter
    HAS_PYFLAKES = True
except ImportError:
    HAS_PYFLAKES = False

router = APIRouter()

class SyntaxCheckRequest(BaseModel):
    code: str

class SyntaxErrorDetail(BaseModel):
    line: int
    col: int
    message: str
    endLine: Optional[int] = None
    endCol: Optional[int] = None
    source: str = "syntax"

class SyntaxCheckResponse(BaseModel):
    ok: bool
    errors: List[SyntaxErrorDetail] = []
    timestamp: float

if HAS_PYFLAKES:
    class ListReporter(pyflakes_reporter.Reporter):
        def __init__(self):
            self.errors: List[SyntaxErrorDetail] = []

        def unexpectedError(self, filename, msg):
            self.errors.append(SyntaxErrorDetail(line=1, col=1, message=str(msg), source="lint"))

        def syntaxError(self, filename, msg, lineno, offset, text):
            self.errors.append(SyntaxErrorDetail(
                line=lineno, 
                col=offset, 
                message=str(msg), 
                source="syntax"
            ))

        def flake(self, message):
            self.errors.append(SyntaxErrorDetail(
                line=message.lineno,
                col=message.col,
                message=message.message % message.message_args,
                source="lint"
            ))

@router.post("/syntax/check", response_model=SyntaxCheckResponse)
async def check_syntax(payload: SyntaxCheckRequest):
    code = payload.code
    errors: List[SyntaxErrorDetail] = []

    # 1. Built-in Syntax Check (AST)
    try:
        ast.parse(code)
    except SyntaxError as e:
        lineno = int(e.lineno or 1)
        offset = int(e.offset or 1)
        end_lineno = int(getattr(e, "end_lineno", lineno) or lineno)
        end_offset = int(getattr(e, "end_offset", offset) or offset)
        errors.append(SyntaxErrorDetail(
            line=lineno,
            col=offset,
            message=str(e.msg),
            endLine=end_lineno,
            endCol=end_offset,
            source="syntax"
        ))
    
    # 2. Pyflakes Check (Linting)
    if HAS_PYFLAKES and not errors:
        reporter = ListReporter()
        try:
            # check(codeString, filename, reporter)
            pyflakes_api.check(code, "input.py", reporter)
            errors.extend(reporter.errors)
        except Exception:
            pass

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "timestamp": time.time()
    }
