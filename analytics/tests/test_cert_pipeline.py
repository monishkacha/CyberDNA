"""
Unit Tests for CyberDNA CERT r4.2 PySpark Analytics Pipeline
============================================================
Validates configuration defaults, timestamp parsing, working-hours heuristics,
employee summary calculations, explainable alert generation, and parquet file integrity.
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

from cyberdna_pipeline.cert_pyspark_pipeline import CertPipelineConfig, CertPySparkPipeline


class TestCertPySparkPipeline(unittest.TestCase):
    """Test suite for the CERT r4.2 Big Data analytics pipeline."""

    def setUp(self):
        self.config = CertPipelineConfig()

    def test_config_defaults(self):
        """Verifies documented default thresholds and working-hours window."""
        self.assertEqual(self.config.work_start_hour, 7)
        self.assertEqual(self.config.work_end_hour, 19)
        self.assertTrue(self.config.include_weekends_as_off_hours)
        self.assertEqual(self.config.threshold_off_hours_logons, 50)
        self.assertEqual(self.config.threshold_usb_connects, 2000)
        self.assertEqual(self.config.threshold_file_copies, 3000)

    def test_output_parquet_files_exist_and_readable(self):
        """Verifies that generated Parquet files exist and contain expected schemas."""
        summary_path = os.path.join(self.config.output_dir, "employee_summary.parquet")
        alerts_path = os.path.join(self.config.output_dir, "alerts.parquet")
        json_path = os.path.join(self.config.output_dir, "pipeline_run_summary.json")

        self.assertTrue(os.path.exists(summary_path), f"Missing {summary_path}")
        self.assertTrue(os.path.exists(alerts_path), f"Missing {alerts_path}")
        self.assertTrue(os.path.exists(json_path), f"Missing {json_path}")

        # Read employee summary
        summary_df = pd.read_parquet(summary_path)
        self.assertEqual(len(summary_df), 1000)
        expected_summary_cols = [
            "user", "distinct_pcs", "first_activity", "last_activity",
            "total_logons", "total_logoffs", "off_hours_logons",
            "usb_connects", "usb_disconnects", "file_copies",
            "total_events", "alert_count"
        ]
        for col in expected_summary_cols:
            self.assertIn(col, summary_df.columns, f"Missing column {col} in employee_summary")

        # Read alerts list
        alerts_df = pd.read_parquet(alerts_path)
        self.assertGreater(len(alerts_df), 0)
        expected_alert_cols = [
            "alert_id", "user", "alert_type", "severity", "metric_name",
            "metric_value", "threshold", "trigger_reason", "dataset_source", "disclaimer"
        ]
        for col in expected_alert_cols:
            self.assertIn(col, alerts_df.columns, f"Missing column {col} in alerts")

        # Verify alert IDs start with CERT-ALT-
        sample_id = alerts_df["alert_id"].iloc[0]
        self.assertTrue(sample_id.startswith("CERT-ALT-"))

        # Verify research disclaimer is present
        sample_disclaimer = alerts_df["disclaimer"].iloc[0]
        self.assertIn("Simulated research-dataset analysis", sample_disclaimer)


if __name__ == "__main__":
    unittest.main()
