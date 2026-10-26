"""
CyberDNA Evaluation Module - Answer Key Loader
==============================================
Loads, validates, and parses the master reference incident key from
analytics/datasets/cert_r4.2/answer_key/answers/insiders.csv.

Enforces strict research isolation:
  - This loader is strictly for post-detection scientific evaluation.
  - It is NEVER imported or referenced by the detection pipeline.
"""

import os
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime
from .config import DEFAULT_ANSWER_KEY_DIR, SCENARIO_DEFINITIONS
from .observables_parser import ObservablesParser


class AnswerKeyLoader:
    """
    Loads and validates the 70 master ground-truth incidents for CERT Release 4.2.
    """

    def __init__(self, answer_key_dir: Optional[str] = None):
        self.answer_key_dir = answer_key_dir or DEFAULT_ANSWER_KEY_DIR

    def load_r42_incidents(self) -> List[Dict[str, Any]]:
        """
        Loads the 70 CERT r4.2 ground-truth incident records from insiders.csv.
        Validates timestamps, duration, and binds each incident to its observables file.
        """
        insiders_path = os.path.join(self.answer_key_dir, "insiders.csv")
        if not os.path.isfile(insiders_path):
            raise FileNotFoundError(f"CERT master answer key not found at: {insiders_path}")

        # Read master answer key
        raw_df = pd.read_csv(insiders_path)
        required_cols = ["dataset", "scenario", "details", "user", "start", "end"]
        for col in required_cols:
            if col not in raw_df.columns:
                raise ValueError(f"Missing expected column '{col}' in insiders.csv")

        # Strictly filter for CERT Release 4.2
        r42_df = raw_df[raw_df["dataset"].astype(str).str.strip() == "4.2"].copy()

        # Validation: Verify exactly 70 master reference incidents
        total_r42 = len(r42_df)
        if total_r42 != 70:
            raise ValueError(f"Expected exactly 70 CERT r4.2 incidents in insiders.csv, found {total_r42}")

        # Parse timestamps safely (MM/dd/yyyy HH:mm:ss format)
        r42_df["start_dt"] = pd.to_datetime(r42_df["start"], format="%m/%d/%Y %H:%M:%S", errors="coerce")
        r42_df["end_dt"] = pd.to_datetime(r42_df["end"], format="%m/%d/%Y %H:%M:%S", errors="coerce")

        if r42_df["start_dt"].isna().any() or r42_df["end_dt"].isna().any():
            raise ValueError("Detected invalid/unparseable timestamps in CERT r4.2 answer key.")

        # Validation: Ensure end >= start for all incidents
        invalid_intervals = r42_df[r42_df["end_dt"] < r42_df["start_dt"]]
        if not invalid_intervals.empty:
            raise ValueError(f"Detected {len(invalid_intervals)} incidents where end timestamp precedes start timestamp.")

        # Validate scenario counts: 30 scenario 1, 30 scenario 2, 10 scenario 3
        counts_by_scenario = r42_df["scenario"].value_counts().to_dict()
        expected_counts = {1: 30, 2: 30, 3: 10}
        for sc, expected in expected_counts.items():
            actual = counts_by_scenario.get(sc, 0)
            if actual != expected:
                raise ValueError(f"Scenario {sc} expected {expected} incidents, found {actual}")

        incidents: List[Dict[str, Any]] = []

        # Sort incidents deterministically by scenario and start timestamp
        r42_df = r42_df.sort_values(by=["scenario", "start_dt", "user"]).reset_index(drop=True)

        for idx, row in r42_df.iterrows():
            scenario = int(row["scenario"])
            user = str(row["user"]).strip()
            details_file = str(row["details"]).strip()
            start_str = str(row["start"]).strip()
            end_str = str(row["end"]).strip()
            start_dt = row["start_dt"]
            end_dt = row["end_dt"]
            duration_hours = round((end_dt - start_dt).total_seconds() / 3600.0, 2)

            # Deterministic incident key
            incident_id = f"CERT-INC-S{scenario}-{user}"

            # Resolve detailed observables file: answers/r4.2-{scenario}/{details_file}
            observables_path = os.path.join(self.answer_key_dir, f"r4.2-{scenario}", details_file)
            observables_data: Dict[str, Any] = {}
            if os.path.isfile(observables_path):
                observables_data = ObservablesParser.parse_file(observables_path)
            else:
                observables_data = {
                    "file_name": details_file,
                    "total_events": 0,
                    "supported_events": 0,
                    "unsupported_events": 0,
                    "supported_ratio": 0.0,
                    "event_counts_by_type": {},
                    "unique_pcs": [],
                    "key_evidence": [],
                    "events_sample": []
                }

            sc_info = SCENARIO_DEFINITIONS.get(scenario, {})

            incident_record = {
                "incident_id": incident_id,
                "dataset": "4.2",
                "scenario": scenario,
                "scenario_title": sc_info.get("title", f"Scenario {scenario}"),
                "scenario_description": sc_info.get("description", ""),
                "primary_threat_vector": sc_info.get("primary_threat_vector", ""),
                "supported_indicators": sc_info.get("supported_indicators", []),
                "unsupported_indicators": sc_info.get("unsupported_indicators", []),
                "user": user,
                "start": start_str,
                "end": end_str,
                "start_iso": start_dt.isoformat(),
                "end_iso": end_dt.isoformat(),
                "duration_hours": duration_hours,
                "observables_file": details_file,
                "observables": observables_data
            }
            incidents.append(incident_record)

        return incidents
