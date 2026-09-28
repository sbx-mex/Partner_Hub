"""Carga validada de Partner Hub desde Query y Directorio."""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import tempfile
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable
from openpyxl import load_workbook

EXPECTED_HEADERS = ("NUM_EMP", "NOMBRE", "F_INGRESO", "F_BAJA", "CCOSTO", "TURNO", "NOM_PUESTO", "F.NAC")
DIRECTORY_HEADERS = ("CC", "CC Nombre", "Región", "Estatus", "DM")
# Campos mínimos públicos: sin número de empleado, año de nacimiento ni CCOSTO original.
RUNTIME_HEADERS = ("NOMBRE", "F_INGRESO", "CECO", "NOM_CCOSTO", "TURNO", "NOM_PUESTO", "REGION", "DM", "CUMPLE_MMDD")
MONTHS = ("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")

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
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip() if value is not None else ""

def sort_key(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", clean_text(value).casefold())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))

def header_key(value: Any) -> str:
    return sort_key(value)

def employee_id(value: Any) -> str:
    if isinstance(value, bool):
        return ""
    if isinstance(value, (int, float)):
        if not math.isfinite(value) or not float(value).is_integer():
            return ""
        value = str(int(value))
    text = clean_text(value)
    return text.split(".", 1)[0].zfill(6) if re.fullmatch(r"\d+(?:\.0+)?", text) else ""

def ceco_from_ccosto(value: Any) -> str:
    """Últimos cinco dígitos; conserva ceros si Excel entrega texto."""
    if isinstance(value, bool):
        return ""
    if isinstance(value, (int, float)):
        if not math.isfinite(value) or not float(value).is_integer():
            return ""
        value = str(int(value))
    text = clean_text(value)
    return text.split(".", 1)[0][-5:] if re.fullmatch(r"\d{5,12}(?:\.0+)?", text) else ""

def directory_ceco(value: Any) -> str:
    """Excel puede guardar el CeCo con ceros iniciales como número."""
    if isinstance(value, bool):
        return ""
    if isinstance(value, (int, float)):
        return str(int(value)).zfill(5) if 0 <= value <= 99999 and math.isfinite(value) and float(value).is_integer() else ""
    text = clean_text(value)
    return text.split(".", 1)[0] if re.fullmatch(r"\d{5}(?:\.0+)?", text) else ""

def is_active_status(value: Any) -> bool:
    return sort_key(value).startswith("activo")

def iso_date(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    text = clean_text(value)
    if not text:
        return ""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError("Fecha no reconocida en Query")

def find_header_row(sheet: Any, expected: Iterable[str], max_rows: int = 10) -> tuple[int, list[str]]:
    required = {header_key(name) for name in expected}
    for row_number, row in enumerate(sheet.iter_rows(min_row=1, max_row=max_rows, values_only=True), 1):
        headers = [clean_text(value) for value in row]
        if required.issubset({header_key(value) for value in headers if value}):
            return row_number, headers
    raise ValueError("Faltan encabezados requeridos: " + ", ".join(expected))

def column_positions(headers: list[str]) -> dict[str, int]:
    positions = {}
    for index, header in enumerate(headers):
        key = header_key(header)
        if key:
            if key in positions:
                raise ValueError(f"Encabezado duplicado o equivalente: {header}")
            positions[key] = index
    return positions

def cell(row: tuple[Any, ...], columns: dict[str, int], header: str) -> Any:
    index = columns[header_key(header)]
    return row[index] if index < len(row) else None

def build_navigation(rows: list[list[Any]], headers: Iterable[str]) -> list[dict[str, Any]]:
    positions = {name: index for index, name in enumerate(headers)}
    groups: dict[tuple[str, str], set[str]] = defaultdict(set)
    labels = {}
    for row in rows:
        region, dm, store = (clean_text(row[positions[name]]) for name in ("REGION", "DM", "NOM_CCOSTO"))
        key = (sort_key(region), sort_key(dm))
        labels[key] = (region, dm)
        groups[key].add(store)
    regions: dict[str, list[dict[str, Any]]] = defaultdict(list)
    region_labels = {}
    for key in sorted(groups):
        region, dm = labels[key]
        region_labels[key[0]] = region
        regions[key[0]].append({"name": dm, "stores": sorted(groups[key], key=sort_key)})
    return [{"name": region_labels[key], "dms": regions[key]} for key in sorted(regions)]

def _digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()

def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise

def _baseline_count(path: str | Path | None) -> int | None:
    if not path or not Path(path).is_file():
        return None
    match = re.search(r"window\.PARTNER_ROWS=(.*);\s*$", Path(path).read_text(encoding="utf-8"), re.S)
    if not match:
        return None
    try:
        return len(json.loads(match.group(1)))
    except (TypeError, ValueError):
        return None

def load_directory(path: str | Path) -> tuple[dict[str, dict[str, str]], set[str], dict[str, int]]:
    directory = Path(path)
    if not directory.is_file():
        raise FileNotFoundError(f"Falta Directorio.xlsx: {directory}")
    workbook = load_workbook(directory, read_only=True, data_only=True)
    try:
        sheet = workbook["Directorio"] if "Directorio" in workbook.sheetnames else workbook.active
        first, headers = find_header_row(sheet, DIRECTORY_HEADERS)
        columns = column_positions(headers)
        stores, conflicts, duplicates = {}, set(), 0
        for row in sheet.iter_rows(min_row=first + 1, values_only=True):
            if not any(value is not None for value in row):
                continue
            ceco = directory_ceco(cell(row, columns, "CC"))
            if not ceco:
                raise ValueError("El Directorio contiene un CeCo inválido")
            record = {key: clean_text(cell(row, columns, source)) for key, source in
                      (("store", "CC Nombre"), ("region", "Región"), ("status", "Estatus"), ("dm", "DM"))}
            if not all(record.values()):
                raise ValueError(f"Datos de tienda incompletos en Directorio: {ceco}")
            if ceco in stores:
                duplicates += 1
                if any(sort_key(stores[ceco][key]) != sort_key(record[key]) for key in record):
                    conflicts.add(ceco)
            else:
                stores[ceco] = record
        return stores, conflicts, {"rows": len(stores) + duplicates, "duplicateCeCos": duplicates,
                                   "conflictingCeCosNotUsed": len(conflicts)}
    finally:
        workbook.close()

def build_partner_data(
    excel_path: str | Path, output_path: str | Path, audit_path: str | Path, *,
    directory_path: str | Path = "data/Directorio.xlsx", sheet_name: str = "query",
    expected_month: int | None = None, expected_year: int | None = None,
    baseline_path: str | Path | None = None, as_of: date | None = None,
) -> BuildResult:
    excel, directory = Path(excel_path), Path(directory_path)
    output, audit_output = Path(output_path), Path(audit_path)
    if len({path.resolve() for path in (excel, directory, output, audit_output)}) != 4:
        raise ValueError("Query, Directorio, salida y auditoría requieren rutas diferentes")
    if not excel.is_file():
        raise FileNotFoundError(f"Falta Query.xlsx: {excel}")
    as_of = as_of or date.today()
    if expected_month is not None and as_of.month != expected_month:
        raise ValueError(f"Mes de carga esperado {expected_month}; fecha de carga {as_of:%Y-%m-%d}")
    if expected_year is not None and as_of.year != expected_year:
        raise ValueError(f"Año de carga esperado {expected_year}; fecha de carga {as_of:%Y-%m-%d}")
    stores, conflicts, directory_audit = load_directory(directory)
    workbook = load_workbook(excel, read_only=True, data_only=True)
    try:
        matches = [name for name in workbook.sheetnames if header_key(name) == header_key(sheet_name)]
        if len(matches) != 1:
            raise ValueError(f"No se encontró una sola pestaña Query: {workbook.sheetnames}")
        sheet = workbook[matches[0]]
        first, headers = find_header_row(sheet, EXPECTED_HEADERS)
        columns = column_positions(headers)
        source_rows = terminated = name_mismatches = identical_rows = 0
        published: list[list[Any]] = []
        seen: dict[str, tuple[Any, ...]] = {}
        for row in sheet.iter_rows(min_row=first + 1, values_only=True):
            if not any(value is not None for value in row):
                continue
            source_rows += 1
            number = employee_id(cell(row, columns, "NUM_EMP"))
            name = clean_text(cell(row, columns, "NOMBRE"))
            ceco = ceco_from_ccosto(cell(row, columns, "CCOSTO"))
            if not number or not name or not ceco:
                raise ValueError(f"Fila Query {first + source_rows}: empleado, nombre o CCOSTO inválido")
            if ceco in conflicts:
                raise ValueError(f"Directorio contradictorio para CeCo {ceco}")
            if ceco not in stores:
                raise ValueError(f"CeCo {ceco} de Query no existe en Directorio")
            store = stores[ceco]
            if sort_key(store["status"]) != "abierta":
                raise ValueError(f"CeCo {ceco} no está abierto en Directorio")
            hire, birth = iso_date(cell(row, columns, "F_INGRESO")), iso_date(cell(row, columns, "F.NAC"))
            if not hire or not birth or date.fromisoformat(hire) > as_of or date.fromisoformat(birth) > as_of:
                raise ValueError(f"Fechas inválidas o posteriores al corte en Query, fila {first + source_rows}")
            termination = iso_date(cell(row, columns, "F_BAJA"))
            if termination:
                terminated += 1
                continue
            shift, role = clean_text(cell(row, columns, "TURNO")), clean_text(cell(row, columns, "NOM_PUESTO"))
            if not shift or not role:
                raise ValueError(f"Turno o puesto vacío en Query, fila {first + source_rows}")
            if header_key("NOM_CCOSTO") in columns and sort_key(cell(row, columns, "NOM_CCOSTO")) != sort_key(store["store"]):
                name_mismatches += 1
            values = (name, hire, ceco, store["store"], shift, role, store["region"], store["dm"], f"--{birth[5:]}")
            if number in seen:
                if seen[number] != values:
                    raise ValueError(f"Empleado duplicado con datos contradictorios en Query, fila {first + source_rows}")
                identical_rows += 1
                continue
            seen[number] = values
            published.append(list(values))
        if not source_rows or not published:
            raise ValueError("Query no contiene partners activos válidos")
    finally:
        workbook.close()
    navigation = build_navigation(published, RUNTIME_HEADERS)
    unique_dms = {(region["name"], dm["name"]) for region in navigation for dm in region["dms"]}
    unique_stores = {row[RUNTIME_HEADERS.index("CECO")] for row in published}
    meta = {
        "source": excel.name, "directory": directory.name, "sheet": matches[0],
        "version": f"{as_of:%Y-%m-%d}-directorio-ceco", "generatedOn": as_of.isoformat(),
        "month": as_of.month, "monthName": MONTHS[as_of.month - 1], "year": as_of.year,
        "sourceRows": source_rows, "publishedRows": len(published),
        "stores": len(unique_stores), "regions": len(navigation),
        "sourceSha256": _digest(excel), "directorySha256": _digest(directory),
    }
    audit = {
        "status": "ok", **meta, "headerRow": first, "columnsRead": list(EXPECTED_HEADERS),
        "columnsPublished": list(RUNTIME_HEADERS), "terminatedExcluded": terminated,
        "identicalEmployeeRowsRemoved": identical_rows, "queryStoreNameDifferences": name_mismatches,
        "directoryAudit": directory_audit,
        "uniqueRegions": len(navigation), "uniqueDM": len(unique_dms), "uniqueStores": len(unique_stores),
        "baselinePublishedRows": _baseline_count(baseline_path),
    }
    js = "// Generado por engine/partner_engine. No editar manualmente.\n"
    for key, value in (("META", meta), ("NAV", navigation), ("HEADERS", RUNTIME_HEADERS), ("ROWS", published)):
        js += f"window.PARTNER_{key}=" + json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + ";\n"
    _atomic_write(output, js)
    _atomic_write(audit_output, json.dumps(audit, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    return BuildResult(source_rows, len(published), as_of.isoformat(), as_of.month, as_of.year,
                       len(navigation), len(unique_dms), len(unique_stores), str(output_path), str(audit_path))
