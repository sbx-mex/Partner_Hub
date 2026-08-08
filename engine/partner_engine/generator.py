from __future__ import annotations

import json
import math
import os
import re
import tempfile
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable

from openpyxl import load_workbook


EXPECTED_HEADERS = [
    "NUM_EMP", "NOMBRE", "F_ALTA", "F_INGRESO", "F_BAJA", "NOM_CCOSTO", "TURNO", "PUESTO",
    "NOM_PUESTO", "PERIODO", "TIPO_EMP", "SEXO", "F.NAC", "M_BAJA", "MOTIVO DE BAJA", "C_BAJA",
    "DESCRIPCION", "EDAD", "RANGO", "ANT.", "ANTIGÜEDAD", "GENERACION", "STATUS", "cc",
    "STATUS_ EMP (ACTIVO/BAJA)", "MES", "AÑO", "ZONAS CRÍTICAS", "Estado", "DIVISION", "DM", "REGION",
]

RUNTIME_HEADERS = [
    "NUM_EMP", "NOMBRE", "F_INGRESO", "NOM_CCOSTO", "TURNO", "NOM_PUESTO", "REGION", "SEXO",
    "F.NAC", "DM", "cc", "EDAD", "RANGO", "STATUS", "DIVISION", "Estado", "STATUS_ EMP (ACTIVO/BAJA)",
]

MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]


@dataclass(frozen=True)
class BuildResult:
    source_rows: int
    published_rows: int
    period_end: str
    month: int
    year: int
    regions: int
    dms: int
    stores: int
    output: str
    audit_output: str


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()


def header_key(value: Any) -> str:
    return clean_text(value).casefold()


def sort_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", clean_text(value).casefold())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def employee_id(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        if math.isfinite(number) and number.is_integer():
            return str(int(number)).zfill(6)
    text = clean_text(value)
    if re.fullmatch(r"\d+(?:\.0+)?", text):
        text = text.split(".", 1)[0]
    return text.zfill(6) if text.isdigit() else text


def is_active_status(value: Any) -> bool:
    return sort_key(clean_text(value)).startswith("activo")


def iso_date(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = clean_text(value)
    if not text:
        return ""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError(f"Fecha no reconocida: {text}")


def json_value(value: Any, header: str) -> Any:
    if header == "NUM_EMP":
        return employee_id(value)
    if header in {"F_ALTA", "F_INGRESO", "F_BAJA", "F.NAC", "MES"}:
        return iso_date(value)
    if value is None:
        return ""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        number = float(value)
        if not math.isfinite(number):
            return ""
        return int(number) if number.is_integer() else number
    return clean_text(value)


def find_header_row(sheet: Any, expected: Iterable[str], max_rows: int = 10) -> tuple[int, list[str]]:
    required = {header_key(name) for name in expected}
    for row_number, row in enumerate(sheet.iter_rows(min_row=1, max_row=max_rows, values_only=True), start=1):
        headers = [clean_text(value) for value in row]
        present = {header_key(value) for value in headers if value}
        if required.issubset(present):
            return row_number, headers
    raise ValueError(f"No se encontró la fila de encabezados en las primeras {max_rows} filas")


def build_navigation(rows: list[list[Any]], headers: list[str]) -> list[dict[str, Any]]:
    index = {name: headers.index(name) for name in ("REGION", "DM", "NOM_CCOSTO")}
    tree: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    labels: dict[tuple[str, str], str] = {}
    for row in rows:
        region, dm, store = (clean_text(row[index[name]]) for name in ("REGION", "DM", "NOM_CCOSTO"))
        if not region:
            continue
        region_key, dm_key = sort_key(region), sort_key(dm)
        labels[("region", region_key)] = region
        labels[(region_key, dm_key)] = dm
        if store:
            tree[region_key][dm_key].add(store)
    navigation = []
    for region_key in sorted(tree, key=lambda key: sort_key(labels[("region", key)])):
        dms = []
        for dm_key in sorted(tree[region_key], key=lambda key: sort_key(labels[(region_key, key)])):
            dms.append({"name": labels[(region_key, dm_key)], "stores": sorted(tree[region_key][dm_key], key=sort_key)})
        navigation.append({"name": labels[("region", region_key)], "dms": dms})
    return navigation


def parse_baseline(path: str | Path | None) -> set[str]:
    if not path:
        return set()
    baseline = Path(path)
    if not baseline.is_file():
        return set()
    text = baseline.read_text(encoding="utf-8")
    header_match = re.search(r"window\.PARTNER_HEADERS=(.*?);\s*window\.PARTNER_ROWS=", text, re.S)
    rows_match = re.search(r"window\.PARTNER_ROWS=(.*);\s*$", text, re.S)
    if not header_match or not rows_match:
        return set()
    headers = json.loads(header_match.group(1))
    rows = json.loads(rows_match.group(1))
    if "NUM_EMP" not in headers:
        return set()
    position = headers.index("NUM_EMP")
    return {employee_id(row[position]) for row in rows if position < len(row) and employee_id(row[position])}


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def build_partner_data(
    excel_path: str | Path,
    output_path: str | Path,
    audit_path: str | Path,
    *,
    sheet_name: str = "Query",
    expected_month: int | None = None,
    expected_year: int | None = None,
    baseline_path: str | Path | None = None,
) -> BuildResult:
    excel = Path(excel_path)
    if not excel.is_file():
        raise FileNotFoundError(f"No existe el Query: {excel}")
    workbook = load_workbook(excel, read_only=True, data_only=True)
    try:
        if sheet_name not in workbook.sheetnames:
            raise ValueError(f"Falta la pestaña obligatoria: {sheet_name}")
        sheet = workbook[sheet_name]
        header_row, raw_headers = find_header_row(sheet, EXPECTED_HEADERS)
        headers = [clean_text(value) for value in raw_headers]
        positions = {header_key(name): index for index, name in enumerate(headers) if name}
        missing = [name for name in EXPECTED_HEADERS if header_key(name) not in positions]
        if missing:
            raise ValueError(f"Faltan campos obligatorios: {', '.join(missing)}")

        source_rows = 0
        exact_duplicates = 0
        duplicate_employees: list[str] = []
        seen_source: set[tuple[Any, ...]] = set()
        seen_employees: set[str] = set()
        status_counts: Counter[str] = Counter()
        period_counts: Counter[str] = Counter()
        blank_counts: Counter[str] = Counter()
        month_dates: list[date] = []
        month_counts: Counter[str] = Counter()
        years: set[int] = set()
        published: list[list[Any]] = []
        runtime_positions = [positions[header_key(name)] for name in RUNTIME_HEADERS]

        for raw in sheet.iter_rows(min_row=header_row + 1, values_only=True):
            if not any(value not in (None, "") for value in raw):
                continue
            source_rows += 1
            source_values = tuple(json_value(raw[positions[header_key(name)]], name) for name in EXPECTED_HEADERS)
            if source_values in seen_source:
                exact_duplicates += 1
                continue
            seen_source.add(source_values)
            for name in EXPECTED_HEADERS:
                if raw[positions[header_key(name)]] in (None, ""):
                    blank_counts[name] += 1
            status = clean_text(raw[positions[header_key("STATUS_ EMP (ACTIVO/BAJA)")]])
            status_counts[status or "(vacío)"] += 1
            period_counts[clean_text(raw[positions[header_key("PERIODO")]]) or "(vacío)"] += 1
            month_text = iso_date(raw[positions[header_key("MES")]])
            if month_text:
                month_dates.append(date.fromisoformat(month_text))
                month_counts[month_text] += 1
            year_value = raw[positions[header_key("AÑO")]]
            try:
                years.add(int(float(year_value)))
            except (TypeError, ValueError):
                pass
            if not is_active_status(status):
                continue
            row = [json_value(raw[position], name) for position, name in zip(runtime_positions, RUNTIME_HEADERS)]
            number = row[RUNTIME_HEADERS.index("NUM_EMP")]
            if number in seen_employees:
                duplicate_employees.append(number)
                continue
            seen_employees.add(number)
            published.append(row)

        if not source_rows:
            raise ValueError("La pestaña Query no contiene filas de datos")
        if duplicate_employees:
            sample = ", ".join(sorted(set(duplicate_employees))[:10])
            raise ValueError(f"NUM_EMP duplicados en filas activas: {sample}")
        if not month_dates:
            raise ValueError("No se pudo detectar la fecha de corte en MES")
        period_end = max(month_dates)
        if expected_month is not None and period_end.month != expected_month:
            raise ValueError(f"Se esperaba mes {expected_month}, pero MES corresponde a {period_end.month}")
        if expected_year is not None and period_end.year != expected_year:
            raise ValueError(f"Se esperaba año {expected_year}, pero MES corresponde a {period_end.year}")

        navigation = build_navigation(published, RUNTIME_HEADERS)
        unique_dms = {dm["name"] for region in navigation for dm in region["dms"]}
        unique_stores = {store for region in navigation for dm in region["dms"] for store in dm["stores"]}
        baseline_ids = parse_baseline(baseline_path)
        current_ids = {row[RUNTIME_HEADERS.index("NUM_EMP")] for row in published}
        changes = {
            "baselineRows": len(baseline_ids),
            "continuing": len(current_ids & baseline_ids),
            "added": len(current_ids - baseline_ids),
            "removed": len(baseline_ids - current_ids),
            "net": len(current_ids) - len(baseline_ids),
        } if baseline_ids else None
        meta = {
            "source": excel.name,
            "sheet": sheet_name,
            "version": f"{period_end:%Y-%m}-python-engine",
            "periodEnd": period_end.isoformat(),
            "month": period_end.month,
            "monthName": MONTHS[period_end.month - 1],
            "year": period_end.year,
            "sourceRows": source_rows,
            "publishedRows": len(published),
        }
        audit = {
            "status": "ok",
            **meta,
            "headerRow": header_row,
            "columnsExpected": len(EXPECTED_HEADERS),
            "columnsFound": len([name for name in EXPECTED_HEADERS if header_key(name) in positions]),
            "headers": EXPECTED_HEADERS,
            "statusCounts": dict(status_counts),
            "periodCounts": dict(period_counts),
            "monthCounts": dict(month_counts),
            "years": sorted(years),
            "exactDuplicateRowsRemoved": exact_duplicates,
            "duplicateEmployeeNumbers": 0,
            "blankCounts": {name: blank_counts[name] for name in EXPECTED_HEADERS},
            "uniqueRegions": len(navigation),
            "uniqueDM": len(unique_dms),
            "uniqueStores": len(unique_stores),
            "comparison": changes,
        }
    finally:
        workbook.close()

    js = "// Generado automáticamente por engine/partner_engine. No editar manualmente.\n"
    js += "window.PARTNER_META=" + json.dumps(meta, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + ";\n"
    js += "window.PARTNER_NAV=" + json.dumps(navigation, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + ";\n"
    js += "window.PARTNER_HEADERS=" + json.dumps(RUNTIME_HEADERS, ensure_ascii=False, separators=(",", ":")) + ";\n"
    js += "window.PARTNER_ROWS=" + json.dumps(published, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + ";\n"
    output, audit_output = Path(output_path), Path(audit_path)
    _atomic_write(output, js)
    _atomic_write(audit_output, json.dumps(audit, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    return BuildResult(source_rows, len(published), period_end.isoformat(), period_end.month, period_end.year, len(navigation), len(unique_dms), len(unique_stores), str(output), str(audit_output))
