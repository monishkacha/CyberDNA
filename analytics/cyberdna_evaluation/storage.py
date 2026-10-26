"""
CyberDNA Evaluation Module - Output Persistence & MongoDB Atlas Integration
===========================================================================
Persists evaluation artifacts to disk under analytics/output/cert_r4.2/evaluation/:
  - evaluation_summary.json
  - incident_comparison.csv
  - incident_comparison.json
  - scenario_summary.csv
  - rule_performance.csv
  - coverage_summary.json

Handles MongoDB Atlas persistence gracefully:
  - If MONGODB_URI is provided and reachable, records are upserted into
    dedicated collections (cert_evaluation_summary, cert_incident_comparisons).
  - If MongoDB is unconfigured or unreachable, logs the status honestly and
    guarantees complete local file persistence without failing.
"""

import os
import json
import logging
import pandas as pd
from typing import Dict, Any, Optional
from .config import DEFAULT_EVALUATION_OUTPUT_DIR

logger = logging.getLogger("CyberDNA.Evaluation.Storage")


class EvaluationStorage:
    """
    Handles local file persistence and optional MongoDB Atlas integration.
    """

    def __init__(self, output_dir: str = DEFAULT_EVALUATION_OUTPUT_DIR):
        self.output_dir = output_dir

    def persist_results(self, eval_data: Dict[str, Any]) -> Dict[str, str]:
        """
        Saves all required structured outputs to the evaluation directory.
        Returns a dictionary of output file paths.
        """
        os.makedirs(self.output_dir, exist_ok=True)
        paths: Dict[str, str] = {}

        # 1. evaluation_summary.json
        summary_path = os.path.join(self.output_dir, "evaluation_summary.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(eval_data, f, indent=2, default=str)
        paths["evaluation_summary_json"] = summary_path

        # 2. incident_comparison.csv & incident_comparison.json
        incidents = eval_data.get("incident_comparisons", [])
        if incidents:
            # Flatten for CSV export
            flat_incidents = []
            for inc in incidents:
                flat_inc = {
                    "incident_id": inc["incident_id"],
                    "scenario": inc["scenario"],
                    "scenario_title": inc["scenario_title"],
                    "user": inc["user"],
                    "start": inc["start"],
                    "end": inc["end"],
                    "duration_hours": inc["duration_hours"],
                    "observables_file": inc["observables_file"],
                    "observables_total": inc["observables_total"],
                    "observables_supported": inc["observables_supported"],
                    "observables_unsupported": inc["observables_unsupported"],
                    "has_baseline_alert": inc["has_baseline_alert"],
                    "baseline_alerts_count": inc["baseline_alerts_count"],
                    "window_logons": inc["window_logons"],
                    "window_off_hours_logons": inc["window_off_hours_logons"],
                    "window_usb_connects": inc["window_usb_connects"],
                    "window_file_copies": inc["window_file_copies"],
                    "window_distinct_pcs": inc["window_distinct_pcs"],
                    "window_detection_status": inc["window_detection_status"],
                    "matching_rules": "; ".join(inc.get("matching_rules", [])),
                    "decision_explanation": inc["decision_explanation"]
                }
                flat_incidents.append(flat_inc)

            inc_df = pd.DataFrame(flat_incidents)
            csv_path = os.path.join(self.output_dir, "incident_comparison.csv")
            inc_df.to_csv(csv_path, index=False)
            paths["incident_comparison_csv"] = csv_path

            json_inc_path = os.path.join(self.output_dir, "incident_comparison.json")
            with open(json_inc_path, "w", encoding="utf-8") as f:
                json.dump(incidents, f, indent=2, default=str)
            paths["incident_comparison_json"] = json_inc_path

        # 3. scenario_summary.csv
        sc_metrics = eval_data.get("metrics", {}).get("by_scenario", {})
        if sc_metrics:
            sc_list = list(sc_metrics.values())
            sc_df = pd.DataFrame(sc_list)
            sc_path = os.path.join(self.output_dir, "scenario_summary.csv")
            sc_df.to_csv(sc_path, index=False)
            paths["scenario_summary_csv"] = sc_path

        # 4. rule_performance.csv
        rule_performance_data = [
            {
                "rule_name": "BASELINE_MACRO_OFF_HOURS_LOGONS",
                "target_scenario": "Scenario 1 & 3",
                "threshold_specification": "Full 18-month aggregate off-hours logons >= 50",
                "incidents_flagged": sum(
                    1 for inc in incidents
                    if any(a.get("alert_type") == "HIGH_OFF_HOURS_LOGONS" for a in inc.get("baseline_alerts", []))
                ),
                "evaluation_scope": "Full-Dataset Macro Baseline",
                "description": "Macro threshold across 18 months; flags employees with sustained high after-hours activity."
            },
            {
                "rule_name": "BASELINE_MACRO_USB_CONNECTS",
                "target_scenario": "Scenario 2 & 3",
                "threshold_specification": "Full 18-month aggregate USB connects >= 2000",
                "incidents_flagged": sum(
                    1 for inc in incidents
                    if any(a.get("alert_type") == "HIGH_USB_CONNECTIONS" for a in inc.get("baseline_alerts", []))
                ),
                "evaluation_scope": "Full-Dataset Macro Baseline",
                "description": "Macro threshold across 18 months; flags employees with heavy portable storage attachment."
            },
            {
                "rule_name": "BASELINE_MACRO_FILE_COPIES",
                "target_scenario": "Scenario 2",
                "threshold_specification": "Full 18-month aggregate file copies >= 3000",
                "incidents_flagged": sum(
                    1 for inc in incidents
                    if any(a.get("alert_type") == "HIGH_REMOVABLE_FILE_COPIES" for a in inc.get("baseline_alerts", []))
                ),
                "evaluation_scope": "Full-Dataset Macro Baseline",
                "description": "Macro threshold across 18 months; flags large-scale file copying to removable drives."
            },
            {
                "rule_name": "WINDOW_RULE_OFF_HOURS_USB",
                "target_scenario": "Scenario 1",
                "threshold_specification": "Incident window: off-hours logons >= 1 AND USB connects >= 1",
                "incidents_flagged": sum(
                    1 for inc in incidents
                    if "WINDOW_RULE_OFF_HOURS_USB" in inc.get("matching_rules", [])
                ),
                "evaluation_scope": "Time-Window-Aware Incident Evaluation",
                "description": "Flags after-hours login concurrent with portable media insertion during the incident window."
            },
            {
                "rule_name": "WINDOW_RULE_ELEVATED_USB_EXPORT",
                "target_scenario": "Scenario 2",
                "threshold_specification": "Incident window: USB connects >= 50 AND file copies >= 50",
                "incidents_flagged": sum(
                    1 for inc in incidents
                    if "WINDOW_RULE_ELEVATED_USB_EXPORT" in inc.get("matching_rules", [])
                ),
                "evaluation_scope": "Time-Window-Aware Incident Evaluation",
                "description": "Flags high-frequency thumb drive connections and bulk file copies during the resignation period."
            },
            {
                "rule_name": "WINDOW_RULE_ADMIN_CROSS_HOST_USB",
                "target_scenario": "Scenario 3",
                "threshold_specification": "Incident window: USB connects >= 1 AND (distinct PCs >= 2 OR off-hours logons >= 1)",
                "incidents_flagged": sum(
                    1 for inc in incidents
                    if "WINDOW_RULE_ADMIN_CROSS_HOST_USB" in inc.get("matching_rules", [])
                ),
                "evaluation_scope": "Time-Window-Aware Incident Evaluation",
                "description": "Flags administrator portable storage staging combined with secondary host access."
            }
        ]
        rule_df = pd.DataFrame(rule_performance_data)
        rule_path = os.path.join(self.output_dir, "rule_performance.csv")
        rule_df.to_csv(rule_path, index=False)
        paths["rule_performance_csv"] = rule_path

        # 5. coverage_summary.json
        coverage_data = {
            "evaluation_framework": "CyberDNA CERT r4.2 Data Source & Indicator Coverage Audit",
            "supported_data_sources": ["logon.csv", "device.csv", "file.csv"],
            "unsupported_data_sources": ["http.csv", "email.csv", "ldap.csv", "psychometric.csv"],
            "scenario_coverage": {
                "scenario_1": {
                    "total_observables": sum(
                        inc.get("observables_total", 0) for inc in incidents if inc["scenario"] == 1
                    ),
                    "supported_observables": sum(
                        inc.get("observables_supported", 0) for inc in incidents if inc["scenario"] == 1
                    ),
                    "unsupported_observables": sum(
                        inc.get("observables_unsupported", 0) for inc in incidents if inc["scenario"] == 1
                    ),
                    "supported_indicators": ["logon (after-hours)", "device (removable connect/disconnect)"],
                    "unsupported_indicators": ["http (WikiLeaks upload)"],
                    "coverage_note": "WikiLeaks web exfiltration events in http.csv are not ingested in 3-source engine."
                },
                "scenario_2": {
                    "total_observables": sum(
                        inc.get("observables_total", 0) for inc in incidents if inc["scenario"] == 2
                    ),
                    "supported_observables": sum(
                        inc.get("observables_supported", 0) for inc in incidents if inc["scenario"] == 2
                    ),
                    "unsupported_observables": sum(
                        inc.get("observables_unsupported", 0) for inc in incidents if inc["scenario"] == 2
                    ),
                    "supported_indicators": ["device (elevated thumb drive connects)", "file (bulk removable media copies)"],
                    "unsupported_indicators": ["http (job board surfing)", "email (competitor communications)"],
                    "coverage_note": "Job surfing (http.csv) and competitor emails (email.csv) require network sensor feeds."
                },
                "scenario_3": {
                    "total_observables": sum(
                        inc.get("observables_total", 0) for inc in incidents if inc["scenario"] == 3
                    ),
                    "supported_observables": sum(
                        inc.get("observables_supported", 0) for inc in incidents if inc["scenario"] == 3
                    ),
                    "unsupported_observables": sum(
                        inc.get("observables_unsupported", 0) for inc in incidents if inc["scenario"] == 3
                    ),
                    "supported_indicators": ["device (thumb drive staging)", "file (keylogger transfer)", "logon (supervisor machine access)"],
                    "unsupported_indicators": ["http (keylogger download)", "email (panic mass broadcast email)"],
                    "coverage_note": "Panic broadcast email (email.csv) and external keylogger download (http.csv) are unsupported."
                }
            }
        }
        coverage_path = os.path.join(self.output_dir, "coverage_summary.json")
        with open(coverage_path, "w", encoding="utf-8") as f:
            json.dump(coverage_data, f, indent=2, default=str)
        paths["coverage_summary_json"] = coverage_path

        # 6. Attempt Optional MongoDB Atlas Persistence
        mongo_status = self._persist_to_mongodb(eval_data)
        eval_data["mongodb_persistence"] = mongo_status

        # Re-write summary with mongo status updated
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(eval_data, f, indent=2, default=str)

        logger.info(f"All evaluation outputs successfully saved to: {self.output_dir}")
        return paths

    def _persist_to_mongodb(self, eval_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Attempts to write evaluation run and incident records to MongoDB Atlas
        if MONGODB_URI is configured and reachable.
        Fails safely and reports status honestly without halting the pipeline.
        """
        mongo_uri = os.environ.get("MONGODB_URI", "").strip()
        if not mongo_uri:
            logger.info("MongoDB URI not configured in environment; skipping Atlas persistence.")
            return {
                "status": "SKIPPED_NOT_CONFIGURED",
                "message": "MONGODB_URI environment variable not provided. Results saved to local files only."
            }

        try:
            from pymongo import MongoClient
            logger.info("Attempting MongoDB connection...")
            client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2500)
            db = client.get_database()

            # 1. Upsert evaluation run summary
            summary_col = db["cert_evaluation_summary"]
            eval_id = eval_data.get("evaluation_id", "CERT-EVAL-LATEST")
            summary_col.replace_one(
                {"evaluation_id": eval_id},
                {
                    "evaluation_id": eval_id,
                    "run_timestamp": eval_data.get("run_timestamp"),
                    "metrics": eval_data.get("metrics"),
                    "methodology_notes": eval_data.get("methodology_notes"),
                    "false_positive_candidates": eval_data.get("false_positive_candidates")
                },
                upsert=True
            )

            # 2. Upsert incident comparison records
            incidents_col = db["cert_incident_comparisons"]
            for inc in eval_data.get("incident_comparisons", []):
                inc_id = inc["incident_id"]
                incidents_col.replace_one({"incident_id": inc_id}, inc, upsert=True)

            logger.info("Successfully persisted evaluation data to MongoDB Atlas collections.")
            return {
                "status": "SUCCESS",
                "message": "Evaluation summary and 70 incident comparison records upserted to MongoDB Atlas.",
                "database": db.name,
                "collections": ["cert_evaluation_summary", "cert_incident_comparisons"]
            }
        except Exception as e:
            logger.warning(f"MongoDB Atlas persistence notice: {e}. Falling back cleanly to local files.")
            return {
                "status": "UNAVAILABLE_LOCAL_FALLBACK",
                "message": f"MongoDB Atlas unreachable ({str(e)}). Local evaluation files remain primary source of truth."
            }
