from typing import Optional, List, Dict, Any
import io

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from app.core.deps import get_db, require_admin
from app.schemas.agents import ConversationExportRequest

router = APIRouter()


@router.post("/admin/export/conversations")
async def export_selected_conversations_excel(
    payload: ConversationExportRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    session_ids = [s for s in (payload.session_ids or []) if s]
    if not session_ids:
        raise HTTPException(status_code=400, detail="未提供 session_ids")
    if len(session_ids) > 200:
        raise HTTPException(status_code=400, detail="一次最多导出 200 个会话")

    sql = text(
        """
        SELECT
            v.id,
            v.session_id,
            v.user_id,
            v.display_user_name,
            u.student_id,
            u.class_name,
            u.study_year,
            v.agent_id,
            v.display_agent_name,
            v.message_type,
            v.content,
            v.response_time_ms,
            v.created_at
        FROM v_conversations_with_deleted v
        LEFT JOIN sys_users u ON v.user_id = u.id
        WHERE session_id = ANY(:session_ids)
        ORDER BY v.session_id ASC, v.created_at ASC, v.id ASC
        """
    )
    result = await db.execute(sql, {"session_ids": session_ids})
    rows = [dict(r) for r in result.mappings().all()]
    if not rows:
        raise HTTPException(status_code=404, detail="未找到对应会话的对话记录")

    def build_excel_bytes(items: List[Dict[str, Any]]) -> bytes:
        def fmt_time(value: Any) -> str:
            if value is None:
                return ""
            if hasattr(value, "isoformat"):
                s = value.isoformat(sep=" ", timespec="microseconds")
            else:
                s = str(value)
            return s.replace("T", " ").replace("Z", "").replace("+00:00", "")

        by_session: Dict[str, List[Dict[str, Any]]] = {}
        for r in items:
            sid = str(r.get("session_id") or "")
            if not sid:
                continue
            by_session.setdefault(sid, []).append(r)

        session_order = sorted(
            by_session.keys(),
            key=lambda sid: max(
                (row.get("created_at") for row in by_session[sid]), default=""
            ),
            reverse=True,
        )

        header = [
            "智能体名称",
            "学生姓名",
            "学号",
            "班级",
            "学年",
            "会话ID",
            "开始时间",
            "结束时间",
            "问题",
            "回答",
        ]

        wb = Workbook()
        ws = wb.active
        ws.title = "对话导出"

        header_fill = PatternFill("solid", fgColor="F2F2F2")
        header_font = Font(bold=True)
        header_alignment = Alignment(
            vertical="center", horizontal="center", wrap_text=True
        )
        left_alignment = Alignment(vertical="center", horizontal="left", wrap_text=True)
        qa_alignment = Alignment(vertical="top", horizontal="left", wrap_text=True)

        ws.append(header)
        for col_idx in range(1, len(header) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment

        ws.freeze_panes = "G2"

        col_widths = {
            "A": 18,
            "B": 14,
            "C": 14,
            "D": 14,
            "E": 10,
            "F": 38,
            "G": 22,
            "H": 22,
            "I": 60,
            "J": 60,
        }
        for col, width in col_widths.items():
            ws.column_dimensions[col].width = width

        current_row = 2
        for sid in session_order:
            rows_for_session = sorted(
                by_session[sid], key=lambda r: (r.get("created_at"), r.get("id"))
            )
            agent_name = str(rows_for_session[0].get("display_agent_name") or "")
            user_name = str(rows_for_session[0].get("display_user_name") or "")
            student_id = str(rows_for_session[0].get("student_id") or "")
            class_name = str(rows_for_session[0].get("class_name") or "")
            study_year = str(rows_for_session[0].get("study_year") or "")

            pending_q: Optional[Dict[str, Any]] = None
            session_start_row = current_row

            for r in rows_for_session:
                mt = r.get("message_type")
                if mt == "question":
                    pending_q = r
                    continue
                if mt == "answer" and pending_q is not None:
                    start_at = fmt_time(pending_q.get("created_at"))
                    end_at = fmt_time(r.get("created_at"))
                    question = str(pending_q.get("content") or "")
                    answer = str(r.get("content") or "")
                    ws.append(
                        [
                            agent_name,
                            user_name,
                            student_id,
                            class_name,
                            study_year,
                            sid,
                            start_at,
                            end_at,
                            question,
                            answer,
                        ]
                    )
                    current_row += 1
                    pending_q = None

            if pending_q is not None:
                start_at = fmt_time(pending_q.get("created_at"))
                question = str(pending_q.get("content") or "")
                ws.append(
                    [
                        agent_name,
                        user_name,
                        student_id,
                        class_name,
                        study_year,
                        sid,
                        start_at,
                        "",
                        question,
                        "",
                    ]
                )
                current_row += 1

            session_end_row = current_row - 1
            if (
                session_end_row >= session_start_row
                and session_end_row > session_start_row
            ):
                for col_idx in range(1, 7):
                    ws.merge_cells(
                        start_row=session_start_row,
                        start_column=col_idx,
                        end_row=session_end_row,
                        end_column=col_idx,
                    )

        for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=1, max_col=10):
            for cell in row:
                if cell.column <= 8:
                    cell.alignment = left_alignment
                else:
                    cell.alignment = qa_alignment

        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()

    excel_bytes = await run_in_threadpool(build_excel_bytes, rows)

    filename = f"conversations_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )

