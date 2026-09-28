from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path


FILES = ["index.html", "styles.css", "app.js", "manifest.webmanifest", "sw.js"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepara los archivos de GitHub Pages.")
    parser.add_argument("--source", default=".")
    parser.add_argument("--output", default="build/site")
    args = parser.parse_args()
    source, output = Path(args.source).resolve(), Path(args.output).resolve()
    audit = json.loads((source / "build/auditoria_query.json").read_text(encoding="utf-8"))
    data = (source / "data/partners.js").read_text(encoding="utf-8")
    meta_match = re.search(r"window\.PARTNER_META=(.*?);", data)
    rows_match = re.search(r"window\.PARTNER_ROWS=(.*);\s*$", data, re.S)
    if not meta_match or not rows_match:
        raise ValueError("Falta la salida de Partner Hub validada")
    meta = json.loads(meta_match.group(1))
    rows = json.loads(rows_match.group(1))
    for field, file_name in (("sourceSha256", "data/Query.xlsx"), ("directorySha256", "data/Directorio.xlsx")):
        actual = hashlib.sha256((source / file_name).read_bytes()).hexdigest()
        if meta.get(field) != actual or audit.get(field) != actual:
            raise ValueError(f"Carga desactualizada respecto a {file_name}")
    if not rows or len(rows) != meta.get("publishedRows") or audit.get("publishedRows") != len(rows):
        raise ValueError("Conteo de partners inconsistente entre fuentes y sitio")
    if output == source:
        raise ValueError("La carpeta de salida no puede ser la fuente")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    for name in FILES:
        shutil.copy2(source / name, output / name)
    shutil.copytree(source / "assets", output / "assets")
    (output / "data").mkdir()
    shutil.copy2(source / "data/partners.js", output / "data/partners.js")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
