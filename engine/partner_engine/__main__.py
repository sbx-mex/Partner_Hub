from __future__ import annotations

import argparse
import json
import sys

from .generator import build_partner_data


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera Partner Hub desde el Excel Query.")
    parser.add_argument("--excel", required=True)
    parser.add_argument("--output", default="data/partners.js")
    parser.add_argument("--audit", default="build/auditoria_query.json")
    parser.add_argument("--sheet", default="Query")
    parser.add_argument("--expected-month", type=int)
    parser.add_argument("--expected-year", type=int)
    parser.add_argument("--baseline")
    args = parser.parse_args()
    try:
        result = build_partner_data(
            args.excel, args.output, args.audit, sheet_name=args.sheet,
            expected_month=args.expected_month, expected_year=args.expected_year, baseline_path=args.baseline,
        )
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps({
        "status": "ok", "sourceRows": result.source_rows, "publishedRows": result.published_rows,
        "periodEnd": result.period_end, "month": result.month, "year": result.year,
        "regions": result.regions, "dms": result.dms, "stores": result.stores,
        "output": result.output, "audit": result.audit_output,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

