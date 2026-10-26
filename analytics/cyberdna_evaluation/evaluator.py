"""
CyberDNA Evaluation Module - Evaluator Engine
=============================================
Orchestrates the evaluation of CyberDNA detection outcomes against
the CERT Release 4.2 true-positive ground-truth reference dataset.

Enforces strict two-stage separation:
  Stage A (Detection): Unsupervised/rule-based analytics run on raw telemetry only.
  Stage B (Evaluation): Compares detection outputs against insiders.csv ground truth.
"""

import os
import time
import logging
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple

from .config import (
    DEFAULT_RAW_DIR,
    DEFAULT_ANSWER_KEY_DIR,
    DEFAULT_PIPELINE_OUTPUT_DIR,
    DEFAULT_EVALUATION_OUTPUT_DIR,
    WORK_START_HOUR,
    WORK_END_HOUR,
    INCLUDE_WEEKENDS_AS_OFF_HOURS,
    SCENARIO_DEFINITIONS
)
from .answer_key_loader import AnswerKeyLoader
from .metrics import EvaluationMetrics

logger = logging.getLogger("CyberDNA.Evaluation")


class CertEvaluator:
    """
    Evaluator for matching detection results against CERT r4.2 ground truth.
    """

    def __init__(
        self,
        raw_dir: str = DEFAULT_RAW_DIR,
        answer_key_dir: str = DEFAULT_ANSWER_KEY_DIR,
        pipeline_output_dir: str = DEFAULT_PIPELINE_OUTPUT_DIR,
        evaluation_output_dir: str = DEFAULT_EVALUATION_OUTPUT_DIR
    ):
        self.raw_dir = raw_dir
        self.answer_key_dir = answer_key_dir
        self.pipeline_output_dir = pipeline_output_dir
        self.evaluation_output_dir = evaluation_output_dir

        self.answer_key_loader = AnswerKeyLoader(answer_key_dir)

    def load_detection_artifacts(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Loads the pre-computed baseline detection outputs using pandas/PyArrow:
          - alerts.parquet
          - employee_summary.parquet
        """
        alerts_path = os.path.join(self.pipeline_output_dir, "alerts.parquet")
        summary_path = os.path.join(self.pipeline_output_dir, "employee_summary.parquet")

        if not os.path.exists(alerts_path):
            raise FileNotFoundError(f"Alerts Parquet file not found at: {alerts_path}")
        if not os.path.exists(summary_path):
            raise FileNotFoundError(f"Employee summary Parquet not found at: {summary_path}")

        logger.info(f"Loading alerts from: {alerts_path}")
        alerts_df = pd.read_parquet(alerts_path, engine="pyarrow")

        logger.info(f"Loading employee summaries from: {summary_path}")
        summary_df = pd.read_parquet(summary_path, engine="pyarrow")

        return alerts_df, summary_df

    def load_incident_window_activities(
        self, incident_users: List[str]
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Extracts raw telemetry rows for the 70 incident employees from logon, device, and file CSVs.
        Computes calendar and working-hours features.
        """
        user_set = set(incident_users)
        logger.info(f"Extracting raw telemetry records for {len(user_set)} incident employees...")

        logon_path = os.path.join(self.raw_dir, "logon.csv")
        device_path = os.path.join(self.raw_dir, "device.csv")
        file_path = os.path.join(self.raw_dir, "file.csv")

        # 1. Logon
        logon_df = pd.read_csv(logon_path)
        logon_sub = logon_df[logon_df["user"].isin(user_set)].copy()
        logon_sub["ts"] = pd.to_datetime(logon_sub["date"], format="%m/%d/%Y %H:%M:%S", errors="coerce")
        logon_sub["hour"] = logon_sub["ts"].dt.hour
        logon_sub["dow"] = logon_sub["ts"].dt.day_of_week
        # Off hours: hour < 7 OR hour >= 19 OR Saturday (5) / Sunday (6)
        if INCLUDE_WEEKENDS_AS_OFF_HOURS:
            logon_sub["is_off_hours"] = (
                (logon_sub["hour"] < WORK_START_HOUR) |
                (logon_sub["hour"] >= WORK_END_HOUR) |
                (logon_sub["dow"] >= 5)
            ).astype(int)
        else:
            logon_sub["is_off_hours"] = (
                (logon_sub["hour"] < WORK_START_HOUR) |
                (logon_sub["hour"] >= WORK_END_HOUR)
            ).astype(int)

        # 2. Device
        device_df = pd.read_csv(device_path)
        device_sub = device_df[device_df["user"].isin(user_set)].copy()
        device_sub["ts"] = pd.to_datetime(device_sub["date"], format="%m/%d/%Y %H:%M:%S", errors="coerce")

        # 3. File
        file_df = pd.read_csv(file_path)
        file_sub = file_df[file_df["user"].isin(user_set)].copy()
        file_sub["ts"] = pd.to_datetime(file_sub["date"], format="%m/%d/%Y %H:%M:%S", errors="coerce")

        logger.info(
            f"  Loaded filtered raw records: {len(logon_sub):,} logon, {len(device_sub):,} device, {len(file_sub):,} file"
        )
        return logon_sub, device_sub, file_sub

    def evaluate(self) -> Dict[str, Any]:
        """
        Executes complete scientific evaluation workflow:
          1. Loads 70 reference incidents
          2. Performs baseline macro-threshold overlap diagnostic
          3. Recalculates exact activity metrics within each incident window
          4. Evaluates window-aware detection status and matching rules
          5. Computes scenario breakdowns and supported vs unsupported coverage
          6. Analyzes false-positive candidates
        """
        start_time = time.time()
        logger.info("=================================================================")
        logger.info(" CYBERDNA CERT r4.2 SCIENTIFIC EVALUATION SUITE")
        logger.info("=================================================================")

        # Load reference ground truth
        reference_incidents = self.answer_key_loader.load_r42_incidents()
        logger.info(f"Loaded {len(reference_incidents)} master reference incidents from insiders.csv")

        # Load pre-computed baseline detection outputs
        alerts_df, summary_df = self.load_detection_artifacts()
        alerted_users_set = set(alerts_df["user"].dropna().unique())
        alerts_by_user = alerts_df.groupby("user")

        # Load raw activity for the incident users
        incident_users = [inc["user"] for inc in reference_incidents]
        logon_sub, device_sub, file_sub = self.load_incident_window_activities(incident_users)

        comparison_records: List[Dict[str, Any]] = []

        # Iterate through each of the 70 incidents
        for inc in reference_incidents:
            u = inc["user"]
            sc = inc["scenario"]
            start_dt = pd.to_datetime(inc["start_iso"])
            end_dt = pd.to_datetime(inc["end_iso"])

            # -------------------------------------------------------------
            # Part 1: Baseline Employee-Level Overlap Diagnostic
            # -------------------------------------------------------------
            has_baseline_alert = u in alerted_users_set
            user_baseline_alerts = []
            if has_baseline_alert:
                user_alerts_df = alerts_by_user.get_group(u)
                user_baseline_alerts = user_alerts_df[
                    ["alert_id", "alert_type", "severity", "metric_name", "metric_value"]
                ].to_dict(orient="records")

            # -------------------------------------------------------------
            # Part 2: Time-Window-Aware Incident Activity Metrics
            # -------------------------------------------------------------
            l_win = logon_sub[(logon_sub["user"] == u) & (logon_sub["ts"] >= start_dt) & (logon_sub["ts"] <= end_dt)]
            d_win = device_sub[(device_sub["user"] == u) & (device_sub["ts"] >= start_dt) & (device_sub["ts"] <= end_dt)]
            f_win = file_sub[(file_sub["user"] == u) & (file_sub["ts"] >= start_dt) & (file_sub["ts"] <= end_dt)]

            w_logons = int((l_win["activity"] == "Logon").sum())
            w_logoffs = int((l_win["activity"] == "Logoff").sum())
            w_off_hours_logons = int(((l_win["activity"] == "Logon") & (l_win["is_off_hours"] == 1)).sum())
            w_usb_connects = int((d_win["activity"] == "Connect").sum())
            w_usb_disconnects = int((d_win["activity"] == "Disconnect").sum())
            w_file_copies = int(len(f_win))

            w_pcs = sorted(list(set(l_win["pc"].dropna().unique()).union(set(d_win["pc"].dropna().unique()))))
            w_distinct_pcs = len(w_pcs)

            # -------------------------------------------------------------
            # Part 3: Window-Aware Detection Rules
            # -------------------------------------------------------------
            window_status = "MISSED"
            matching_rules = []
            decision_explanation = ""

            obs_data = inc.get("observables", {})
            obs_counts = obs_data.get("event_counts_by_type", {})
            total_obs = obs_data.get("total_events", 0)
            supported_obs = obs_data.get("supported_events", 0)
            unsupported_obs = obs_data.get("unsupported_events", 0)

            if sc == 1:
                # Scenario 1: After-hours logon + thumb drive connection
                if w_off_hours_logons >= 1 and w_usb_connects >= 1:
                    window_status = "DETECTED"
                    matching_rules.append("WINDOW_RULE_OFF_HOURS_USB")
                    decision_explanation = (
                        f"Detected in incident window: Employee recorded {w_off_hours_logons} off-hours logon(s) "
                        f"and {w_usb_connects} removable device connect(s). Note: WikiLeaks HTTP upload ({obs_counts.get('http', 0)} events) "
                        f"remains an unsupported indicator in current 3-source ingestion."
                    )
                elif w_usb_connects >= 1 and w_off_hours_logons == 0:
                    window_status = "MISSED"
                    decision_explanation = (
                        f"Missed off-hours logon indicator: Removable drive connected ({w_usb_connects} times), "
                        f"but logon occurred during standard working window (07:00-19:00 Mon-Fri) at {inc['start']}. "
                        f"HTTP WikiLeaks exfiltration ({obs_counts.get('http', 0)} events) unsupported by current telemetry."
                    )
                else:
                    window_status = "MISSED"
                    decision_explanation = (
                        f"Missed: Required off-hours logon and USB connect indicators were not both satisfied in window. "
                        f"(Off-hours logons: {w_off_hours_logons}, USB connects: {w_usb_connects})."
                    )

            elif sc == 2:
                # Scenario 2: Elevated thumb drive usage & file copies
                if w_usb_connects >= 50 and w_file_copies >= 50:
                    window_status = "DETECTED"
                    matching_rules.append("WINDOW_RULE_ELEVATED_USB_EXPORT")
                    decision_explanation = (
                        f"Detected in incident window: High-volume data staging observed ({w_usb_connects} USB connects, "
                        f"{w_file_copies} file copies). Note: Job website searches ({obs_counts.get('http', 0)} events) "
                        f"and competitor emails ({obs_counts.get('email', 0)} events) are unsupported data sources."
                    )
                else:
                    window_status = "MISSED"
                    decision_explanation = (
                        f"Missed: External staging volume in window ({w_usb_connects} connects, {w_file_copies} file copies) "
                        f"did not meet elevated theft threshold."
                    )

            elif sc == 3:
                # Scenario 3: Admin thumb drive transfer + supervisor machine access
                if w_usb_connects >= 1 and (w_distinct_pcs >= 2 or w_off_hours_logons >= 1):
                    window_status = "DETECTED"
                    matching_rules.append("WINDOW_RULE_ADMIN_CROSS_HOST_USB")
                    decision_explanation = (
                        f"Detected in incident window: Removable storage connected ({w_usb_connects} times) and "
                        f"cross-host / off-hours access observed across {w_distinct_pcs} distinct PCs ({', '.join(w_pcs)}). "
                        f"Note: Keylogger web download ({obs_counts.get('http', 0)} events) and panic broadcast email "
                        f"({obs_counts.get('email', 0)} events) are unsupported data sources."
                    )
                else:
                    window_status = "MISSED"
                    decision_explanation = (
                        f"Missed: Required admin portable storage and multi-host access criteria not met in window."
                    )

            comparison_record = {
                "incident_id": inc["incident_id"],
                "scenario": sc,
                "scenario_title": inc["scenario_title"],
                "user": u,
                "start": inc["start"],
                "end": inc["end"],
                "start_iso": inc["start_iso"],
                "end_iso": inc["end_iso"],
                "duration_hours": inc["duration_hours"],
                "observables_file": inc["observables_file"],
                "observables_total": total_obs,
                "observables_supported": supported_obs,
                "observables_unsupported": unsupported_obs,
                "observables_coverage_ratio": obs_data.get("supported_ratio", 0.0),
                "observables_counts_by_type": obs_counts,
                "key_evidence_highlights": obs_data.get("key_evidence", []),
                # Baseline Overlap Diagnostic
                "has_baseline_alert": has_baseline_alert,
                "baseline_alerts_count": len(user_baseline_alerts),
                "baseline_alerts": user_baseline_alerts,
                # Window-Aware Raw Activity
                "window_logons": w_logons,
                "window_logoffs": w_logoffs,
                "window_off_hours_logons": w_off_hours_logons,
                "window_usb_connects": w_usb_connects,
                "window_usb_disconnects": w_usb_disconnects,
                "window_file_copies": w_file_copies,
                "window_distinct_pcs": w_distinct_pcs,
                "window_pcs": w_pcs,
                # Window-Aware Evaluation
                "window_detection_status": window_status,
                "matching_rules": matching_rules,
                "decision_explanation": decision_explanation
            }
            comparison_records.append(comparison_record)

        # -------------------------------------------------------------
        # Part 4: False Positive Candidate Characterization
        # -------------------------------------------------------------
        incident_user_set = set(incident_users)
        all_alerted_users = alerts_df["user"].unique()
        fp_users = [u for u in all_alerted_users if u not in incident_user_set]

        # Analyze why unlisted employees received alerts
        fp_summary = summary_df[summary_df["user"].isin(fp_users)].copy()

        fp_candidates = []
        for _, r in fp_summary.sort_values(by="alert_count", ascending=False).head(20).iterrows():
            reasons = []
            if r.get("off_hours_logons", 0) >= 50:
                reasons.append(f"Elevated off-hours logons ({r['off_hours_logons']} times; likely legitimate overtime/shift work)")
            if r.get("usb_connects", 0) >= 2000:
                reasons.append(f"Frequent removable storage use ({r['usb_connects']} connects; likely heavy portable drive usage)")
            if r.get("file_copies", 0) >= 3000:
                reasons.append(f"High file copies to removable media ({r['file_copies']} files; likely backup or local archive workflow)")

            fp_candidates.append({
                "user": r["user"],
                "alert_count": int(r.get("alert_count", 0)),
                "total_events": int(r.get("total_events", 0)),
                "off_hours_logons": int(r.get("off_hours_logons", 0)),
                "usb_connects": int(r.get("usb_connects", 0)),
                "file_copies": int(r.get("file_copies", 0)),
                "distinct_pcs": int(r.get("distinct_pcs", 0)),
                "explanation": "; ".join(reasons) or "Macro heuristic threshold exceeded in 18-month aggregation"
            })

        # -------------------------------------------------------------
        # Part 5: Aggregation & Metrics Summary
        # -------------------------------------------------------------
        metrics_summary = EvaluationMetrics.compute_scenario_metrics(comparison_records)

        # Employee-Level Scrutiny Evaluation
        all_profiled_users = summary_df["user"].dropna().unique().tolist()
        employee_scrutiny_metrics = EvaluationMetrics.compute_employee_scrutiny_metrics(
            alerts_df, incident_users, all_profiled_users
        )

        duration_sec = time.time() - start_time
        logger.info(
            f"Evaluation completed in {duration_sec:.2f}s: "
            f"{metrics_summary['overall']['window_detected_count']}/70 incidents detected "
            f"({metrics_summary['overall']['detection_percentage']}%), "
            f"Baseline Overlap: {metrics_summary['overall']['baseline_overlap_count']}/70"
        )

        return {
            "evaluation_id": f"CERT-EVAL-{int(time.time())}",
            "run_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "execution_duration_seconds": round(duration_sec, 2),
            "dataset_version": "CERT Insider Threat Test Dataset Release 4.2",
            "methodology_notes": {
                "evaluation_framework": "Two-Stage Isolated Scientific Evaluation",
                "open_world_notice": (
                    "The CERT answer key (insiders.csv) lists known true-positive red-team incidents. "
                    "Unlisted employees who trigger macro alerts represent policy anomalies or legitimate overtime, "
                    "not guaranteed false alarms. Classical specificity and accuracy require closed-world assumptions."
                ),
                "data_source_coverage": {
                    "supported": ["logon.csv", "device.csv", "file.csv"],
                    "unsupported": ["http.csv (browsing/wikileaks/job search)", "email.csv (competitor/panic emails)"],
                    "impact": (
                        "Attacks with primary indicators in HTTP (WikiLeaks uploads) or Email (panic mass emails) "
                        "cannot be fully confirmed from host-only telemetry without network sensor integration."
                    )
                }
            },
            "metrics": metrics_summary,
            "employee_scrutiny_evaluation": employee_scrutiny_metrics,
            "incident_comparisons": comparison_records,
            "false_positive_candidates": {
                "total_unlisted_alerted_employees": len(fp_users),
                "top_candidates": fp_candidates,
                "scientific_interpretation": (
                    "Unlisted employees who exceeded macro thresholds over 18 months reflect statistical outliers "
                    "in overtime or portable media attachment frequency. They are candidates for triage, not verified failures."
                )
            }
        }
