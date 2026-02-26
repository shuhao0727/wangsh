from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import quote

from app.core.deps import require_admin
from app.db.database import get_db
from app.services.xbk.exports.course_selection import build_student_course_selection_xlsx
from app.services.xbk.exports.class_distribution import build_class_distribution_xlsx
from app.services.xbk.exports.teacher_distribution import build_teacher_distribution_xlsx


router = APIRouter()


@router.get("/export/{export_type}")
async def export_tables(
    export_type: str,
    year: int = Query(...),
    term: str = Query(...),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    year_start: Optional[int] = Query(None, alias="yearStart"),
    year_end: Optional[int] = Query(None, alias="yearEnd"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> StreamingResponse:
    if export_type not in ["course-selection", "distribution", "teacher-distribution"]:
        raise HTTPException(status_code=400, detail="不支持的导出类型")

    if export_type == "course-selection":
        output = await build_student_course_selection_xlsx(db, year, term, class_name, year_start, year_end)
        prefix = "学生选课表"
    elif export_type == "distribution":
        output = await build_class_distribution_xlsx(db, year, term, grade, class_name, year_start, year_end)
        prefix = "各班分发表"
    else:
        output = await build_teacher_distribution_xlsx(db, year, term, class_name, year_start, year_end)
        prefix = "教师分发表"

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ys = year_start if year_start is not None else year
    ye = year_end if year_end is not None else year + 1
    parts = [prefix, f"{ys}-{ye}", term, timestamp]
    if class_name:
        parts.insert(2, class_name)
    filename = "_".join(parts) + ".xlsx"
    fallback_name = f"xbk_export_{timestamp}.xlsx"
    quoted = quote(filename)
    headers = {"Content-Disposition": f"attachment; filename=\"{fallback_name}\"; filename*=UTF-8''{quoted}"}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
