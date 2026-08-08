from __future__ import annotations

import argparse
import shutil
from pathlib import Path


FILES = ["index.html", "styles.css", "app.js", "manifest.webmanifest", "sw.js"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepara los archivos de GitHub Pages.")
    parser.add_argument("--source", default=".")
    parser.add_argument("--output", default="build/site")
    args = parser.parse_args()
    source, output = Path(args.source).resolve(), Path(args.output).resolve()
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

