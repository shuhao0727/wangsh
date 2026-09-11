"""Bounded CSV/Excel decoding and physical-header validation; no DB access."""

import csv
import io
import zipfile
from typing import Any, Optional

import pandas as pd
from fastapi import HTTPException


def normalize_str(v: Any) -> Optional[str]:
    if v is None or pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None


def normalize_col_name(v: Any) -> str:
    return (normalize_str(v) or "").replace("\ufeff", "").replace("\u00a0", "").replace(" ", "")


def read_csv_rows(content: bytes, max_rows: int, max_columns: int) -> pd.DataFrame:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("gb18030")
    # csv.reader preserves literal identifiers (including leading zeros/NA)
    # and lets us reject surplus cells rather than infer an implicit index.
    rows = []
    reader = csv.reader(io.StringIO(text, newline=""), strict=True)
    for row in reader:
        if len(row) > max_columns:
            raise HTTPException(status_code=413, detail=f"导入列数不能超过 {max_columns}")
        rows.append(row)
        if len(rows) > max_rows + 1:
            raise HTTPException(status_code=413, detail=f"导入数据不能超过 {max_rows} 行")
    if not rows:
        raise HTTPException(status_code=400, detail="文件为空或没有表头")
    width = len(rows[0])
    if any(len(row) > width for row in rows[1:]):
        raise HTTPException(status_code=400, detail="CSV 数据列数超过表头列数，请检查分隔符或引号")
    return pd.DataFrame(rows)


def read_excel_rows(content: bytes, extension: str, max_rows: int, max_expanded_bytes: int) -> pd.DataFrame:
    # Existing exports may contain XLSX bytes with an .xls filename.
    # Keep those readable, but never treat arbitrary non-Excel bytes as CSV.
    is_xlsx = zipfile.is_zipfile(io.BytesIO(content))
    if is_xlsx:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            if sum(info.file_size for info in archive.infolist()) > max_expanded_bytes:
                raise HTTPException(status_code=413, detail="Excel 解压后内容过大，请拆分文件")
    engine = "openpyxl" if is_xlsx or extension == ".xlsx" else "xlrd"
    return pd.read_excel(
        io.BytesIO(content), engine=engine, header=None, dtype=str,
        keep_default_na=False, nrows=max_rows + 2,
    )


def validate_import_header(raw: pd.DataFrame, max_rows: int, max_columns: int) -> pd.DataFrame:
    if raw.empty:
        raise HTTPException(status_code=400, detail="文件为空或没有表头")
    if raw.shape[0] > max_rows + 1 or raw.shape[1] > max_columns:
        raise HTTPException(status_code=413, detail=f"导入不能超过 {max_rows} 行、{max_columns} 列")
    # Read the header as data so pandas cannot silently rename duplicates to .1.
    columns = [normalize_col_name(value) for value in raw.iloc[0]]
    nonempty = [name for name in columns if name]
    if len(nonempty) != len(set(nonempty)):
        raise HTTPException(status_code=422, detail="表头包含重复列，请删除重复列后重试")
    df = raw.iloc[1:].copy()
    df.columns = columns
    # Preserve physical worksheet row offsets even after dropping blank lines.
    df.index = range(len(df))
    return df.fillna("")
