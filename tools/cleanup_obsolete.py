"""Retira cuatro auditorías históricas sin uso en el sitio ni el motor."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OBSOLETE = (
    "AUDITORIA_JULIO.md",
    "AUDITORIA_REGION_FILTROS.txt",
    "data/audit-june.json",
    "data/audit-query.json",
)

if __name__ == "__main__":
    for relative in OBSOLETE:
        path = ROOT / relative
        path.unlink(missing_ok=True)
        print(f"Retirado: {relative}")
