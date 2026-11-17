from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from openpyxl import Workbook, load_workbook

from app.utils.excel_safety import force_text_workbook

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def test_force_text_workbook_prevents_formula_cells():
    wb = Workbook()
    ws = wb.active
    for value in [
        '=HYPERLINK("http://example.com")',
        "=1+1",
        "+1+1",
        "-1+1",
        "@SUM(A1:A2)",
        "正常文本",
    ]:
        ws.append([value])

    force_text_workbook(wb)
    buffer = BytesIO()
    wb.save(buffer)
    content = buffer.getvalue()

    with ZipFile(BytesIO(content)) as archive:
        sheet_name = next(
            name for name in archive.namelist()
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
        )
        root = ET.fromstring(archive.read(sheet_name))
        assert not root.findall(".//s:c/s:f", NS)
        for cell in root.findall(".//s:c", NS):
            assert cell.get("t") not in {"f", "e", "str"}

    loaded = load_workbook(BytesIO(content), data_only=False)
    for row in loaded.active.iter_rows():
        for cell in row:
            if isinstance(cell.value, str):
                assert cell.data_type == "s"
                assert cell.number_format == "@"


def test_exports_call_force_text_workbook_before_saving():
    backend = Path(__file__).resolve().parents[2]
    sources = [
        backend / "app/api/endpoints/agents/ai_agents/export.py",
        backend / "app/services/assessment/export_service.py",
        backend / "app/api/endpoints/agents/ai_agents/group_discussion_admin.py",
    ]
    for source in sources:
        text = source.read_text(encoding="utf-8")
        assert text.count("force_text_workbook(wb)") == text.count("wb.save("), source
        assert text.index("force_text_workbook(wb)") < text.rindex("wb.save("), source
