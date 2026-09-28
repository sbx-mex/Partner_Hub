#!/usr/bin/env python3

import sys

from engine.partner_engine.__main__ import main


if __name__ == "__main__":
    defaults = {
        "--excel": "data/Query.xlsx",
        "--output": "data/partners.js",
        "--audit": "build/auditoria_query.json",
        "--directory": "data/Directorio.xlsx",
    }
    for option, value in defaults.items():
        if option not in sys.argv:
            sys.argv.extend([option, value])
    raise SystemExit(main())
