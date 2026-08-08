import unittest
from datetime import datetime

from engine.partner_engine.generator import RUNTIME_HEADERS, build_navigation, employee_id, is_active_status, iso_date


class PartnerEngineTests(unittest.TestCase):
    def test_employee_id_preserves_leading_zero(self):
        self.assertEqual(employee_id(33903), "033903")
        self.assertEqual(employee_id("033903"), "033903")

    def test_date_serialization(self):
        self.assertEqual(iso_date(datetime(2026, 7, 31)), "2026-07-31")

    def test_active_status_does_not_accept_inactive(self):
        self.assertTrue(is_active_status("ACTIVOS"))
        self.assertFalse(is_active_status("INACTIVOS"))
        self.assertFalse(is_active_status("BAJAS"))

    def test_navigation_is_grouped_and_sorted(self):
        def row(region, dm, store):
            values = [""] * len(RUNTIME_HEADERS)
            values[RUNTIME_HEADERS.index("REGION")] = region
            values[RUNTIME_HEADERS.index("DM")] = dm
            values[RUNTIME_HEADERS.index("NOM_CCOSTO")] = store
            return values
        nav = build_navigation([row("NORTE", "DM B", "Tienda 2"), row("NORTE", "DM A", "Tienda 1")], RUNTIME_HEADERS)
        self.assertEqual(nav[0]["name"], "NORTE")
        self.assertEqual([item["name"] for item in nav[0]["dms"]], ["DM A", "DM B"])


if __name__ == "__main__":
    unittest.main()
