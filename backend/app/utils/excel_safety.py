"""Shared XLSX text-safety helpers for exports."""

from __future__ import annotations

from functools import partial
from io import BytesIO
from zipfile import ZipFile


def _save_preserving_carriage_returns(original_save, target) -> None:
    """Rewrite raw CR as a character reference before XML readers normalize it."""
    with BytesIO() as raw:
        original_save(raw)
        with ZipFile(raw) as source, ZipFile(target, "w") as destination:
            destination.comment = source.comment
            for member in source.infolist():
                data = source.read(member)
                if member.filename.startswith("xl/worksheets/") and member.filename.endswith(".xml"):
                    data = data.replace(b"\r", b"&#13;")
                destination.writestr(member, data)


def force_text_cells(ws) -> None:
    """Make every string cell literal before saving as XLSX.

    openpyxl infers formulas (and Excel errors) from some string values. An
    explicit string type, not just a text number format or prefix blacklist,
    prevents those values from becoming executable worksheet cells. Keep the
    original value, including whitespace and leading zeros; numeric counts,
    blank cells, styles and application-owned data validations are untouched.
    Exports for this project do not intentionally contain cell formulas.
    """
    has_carriage_return = False
    for row in ws.iter_rows():
        for cell in row:
            if isinstance(cell.value, str):
                cell.data_type = "s"
                cell.number_format = "@"
                has_carriage_return |= "\r" in cell.value

    wb = ws.parent
    if has_carriage_return and not getattr(wb, "_excel_cr_safe_save", False):
        wb.save = partial(_save_preserving_carriage_returns, wb.save)
        wb._excel_cr_safe_save = True


def force_text_workbook(wb) -> None:
    """Finalize all sheets after a workbook has been populated."""
    for ws in wb.worksheets:
        force_text_cells(ws)
