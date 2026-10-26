"""
Unit Tests for CyberDNA CERT r4.2 Scientific Evaluation Suite
============================================================
Tests answer key loading, observables parsing, time-window matching,
metric calculations on known examples, and strict research isolation.
"""

import os
import sys
import unittest
import pandas as pd
from datetime import datetime

# Add analytics directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
analytics_dir = os.path.dirname(current_dir)
if analytics_dir not in sys.path:
    sys.path.insert(0, analytics_dir)

from cyberdna_evaluation.config import (
    DEFAULT_ANSWER_KEY_DIR,
    DEFAULT_EVALUATION_OUTPUT_DIR,
    SCENARIO_DEFINITIONS,
    SUPPORTED_DATA_SOURCES,
    UNSUPPORTED_DATA_SOURCES
)
from cyberdna_evaluation.answer_key_loader import AnswerKeyLoader
from cyberdna_evaluation.observables_parser import ObservablesParser
from cyberdna_evaluation.metrics import EvaluationMetrics


class TestCyberDNAEvaluation(unittest.TestCase):
    """Test suite for the CERT r4.2 evaluation framework."""

    def setUp(self):
        self.loader = AnswerKeyLoader(DEFAULT_ANSWER_KEY_DIR)

    def test_load_all_70_master_incidents(self):
        """Verifies that exactly 70 CERT r4.2 master incidents are loaded."""
        incidents = self.loader.load_r42_incidents()
        self.assertEqual(len(incidents), 70)

        # Scenario distribution: 30 Scenario 1, 30 Scenario 2, 10 Scenario 3
        sc_counts = pd.Series([inc["scenario"] for inc in incidents]).value_counts().to_dict()
        self.assertEqual(sc_counts.get(1), 30)
        self.assertEqual(sc_counts.get(2), 30)
        self.assertEqual(sc_counts.get(3), 10)

    def test_incident_timestamps_valid_and_consistent(self):
        """Verifies start and end timestamps, format, and intervals."""
        incidents = self.loader.load_r42_incidents()
        for inc in incidents:
            start_dt = pd.to_datetime(inc["start_iso"])
            end_dt = pd.to_datetime(inc["end_iso"])
            self.assertFalse(pd.isna(start_dt))
            self.assertFalse(pd.isna(end_dt))
            self.assertGreaterEqual(end_dt, start_dt, f"End precedes start for {inc['incident_id']}")
            self.assertGreaterEqual(inc["duration_hours"], 0.0)

    def test_observables_parsing_supported_and_unsupported(self):
        """Tests observables parsing and classification of supported vs unsupported data sources."""
        incidents = self.loader.load_r42_incidents()
        # Find AAM0658 in Scenario 1
        aam = next((inc for inc in incidents if inc["user"] == "AAM0658"), None)
        self.assertIsNotNone(aam)
        obs = aam["observables"]
        self.assertGreater(obs["total_events"], 0)
        # In AAM0658: logon and device are supported, http is unsupported
        counts = obs["event_counts_by_type"]
        self.assertIn("logon", counts)
        self.assertIn("device", counts)
        self.assertIn("http", counts)
        self.assertEqual(obs["supported_events"], counts["logon"] + counts["device"])
        self.assertEqual(obs["unsupported_events"], counts["http"])

    def test_metric_calculations_on_known_synthetic_example(self):
        """Verifies scenario metric formulation on a controlled known test dataset."""
        synthetic_records = [
            # Scenario 1: 2 incidents (1 detected, 1 missed)
            {
                "scenario": 1,
                "has_baseline_alert": False,
                "window_detection_status": "DETECTED",
                "observables_total": 10,
                "observables_supported": 8,
                "observables_unsupported": 2
            },
            {
                "scenario": 1,
                "has_baseline_alert": False,
                "window_detection_status": "MISSED",
                "observables_total": 10,
                "observables_supported": 8,
                "observables_unsupported": 2
            },
            # Scenario 2: 2 incidents (both detected)
            {
                "scenario": 2,
                "has_baseline_alert": True,
                "window_detection_status": "DETECTED",
                "observables_total": 20,
                "observables_supported": 10,
                "observables_unsupported": 10
            },
            {
                "scenario": 2,
                "has_baseline_alert": False,
                "window_detection_status": "DETECTED",
                "observables_total": 20,
                "observables_supported": 10,
                "observables_unsupported": 10
            },
            # Scenario 3: 1 incident (detected)
            {
                "scenario": 3,
                "has_baseline_alert": True,
                "window_detection_status": "DETECTED",
                "observables_total": 5,
                "observables_supported": 3,
                "observables_unsupported": 2
            }
        ]

        metrics = EvaluationMetrics.compute_scenario_metrics(synthetic_records)
        sc1 = metrics["by_scenario"][1]
        self.assertEqual(sc1["total_incidents"], 2)
        self.assertEqual(sc1["window_detected_count"], 1)
        self.assertEqual(sc1["detection_percentage"], 50.0)

        sc2 = metrics["by_scenario"][2]
        self.assertEqual(sc2["total_incidents"], 2)
        self.assertEqual(sc2["window_detected_count"], 2)
        self.assertEqual(sc2["detection_percentage"], 100.0)

        overall = metrics["overall"]
        self.assertEqual(overall["total_incidents"], 5)
        self.assertEqual(overall["window_detected_count"], 4)
        self.assertEqual(overall["detection_percentage"], 80.0)
        self.assertEqual(overall["baseline_overlap_count"], 2)
        self.assertEqual(overall["baseline_overlap_percentage"], 40.0)

    def test_detection_pipeline_strict_isolation(self):
        """Verifies that the detection pipeline never imports or references answer key files."""
        detection_script_path = os.path.join(analytics_dir, "cyberdna_pipeline", "cert_pyspark_pipeline.py")
        with open(detection_script_path, "r", encoding="utf-8") as f:
            code = f.read()

        # Must not import answer_key or evaluation modules
        self.assertNotIn("insiders.csv", code)
        self.assertNotIn("answer_key", code)
        self.assertNotIn("cyberdna_evaluation", code)

    def test_output_artifacts_exist(self):
        """Verifies that evaluation summary and comparison files are created and valid."""
        summary_file = os.path.join(DEFAULT_EVALUATION_OUTPUT_DIR, "evaluation_summary.json")
        incident_file = os.path.join(DEFAULT_EVALUATION_OUTPUT_DIR, "incident_comparison.json")

        self.assertTrue(os.path.exists(summary_file), f"Missing {summary_file}")
        self.assertTrue(os.path.exists(incident_file), f"Missing {incident_file}")

    def test_employee_scrutiny_metrics_calculation(self):
        """Verifies calculation of employee-level scrutiny metrics without synthetic TN assumptions."""
        # Synthetic alerts df
        alerts_data = [
            {"user": "USER_A", "alert_type": "COMPOUND_OFF_HOURS_USB_ACTIVITY"},
            {"user": "USER_B", "alert_type": "HIGH_OFF_HOURS_LOGONS"},
            {"user": "USER_B", "alert_type": "HIGH_USB_CONNECTIONS"},
            {"user": "USER_C", "alert_type": "HIGH_OFF_HOURS_LOGONS"},
            {"user": "USER_D", "alert_type": "HIGH_REMOVABLE_FILE_COPIES"},
            {"user": "USER_D", "alert_type": "HIGH_USB_CONNECTIONS"}
        ]
        alerts_df = pd.DataFrame(alerts_data)
        ref_users = ["USER_A", "USER_B", "USER_E"]  # USER_E has no alerts
        all_users = ["USER_A", "USER_B", "USER_C", "USER_D", "USER_E", "USER_F"]

        scrutiny = EvaluationMetrics.compute_employee_scrutiny_metrics(alerts_df, ref_users, all_users)

        self.assertEqual(scrutiny["distinct_reference_employees"], 3)
        self.assertEqual(scrutiny["total_high_scrutiny_employees"], 3)  # USER_A (compound), USER_B (2 alerts), USER_D (2 alerts)
        self.assertEqual(scrutiny["reference_employees_high_scrutiny"], 2)  # USER_A, USER_B
        self.assertEqual(scrutiny["reference_employees_not_high_scrutiny"], 1)  # USER_E
        self.assertEqual(scrutiny["non_reference_employees_high_scrutiny"], 1)  # USER_D
        self.assertIn("open_world_notice", scrutiny)

    def test_unavailable_metrics_are_not_fabricated(self):
        """Verifies that accuracy, precision, and F1 are not fabricated without negative ground truth."""
        summary_file = os.path.join(DEFAULT_EVALUATION_OUTPUT_DIR, "evaluation_summary.json")
        import json
        with open(summary_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        metrics = data.get("metrics", {}).get("overall", {})
        # Precision and accuracy must NOT be computed or present in the main metrics
        self.assertNotIn("precision", metrics)
        self.assertNotIn("accuracy", metrics)
        self.assertNotIn("f1_score", metrics)
        self.assertIn("open_world_notice", data.get("methodology_notes", {}))


if __name__ == "__main__":
    unittest.main()

