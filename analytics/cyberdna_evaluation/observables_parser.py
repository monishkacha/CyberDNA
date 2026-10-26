"""
CyberDNA Evaluation Module - Observables Parser
===============================================
Defensively parses CERT r4.2 variable-length incident observables files.
Each observables file represents ground-truth red-team event records
interleaved in chronological order with the event type as the first token.

Supported event types:
  - logon:  logon/logoff authentications
  - device: removable media connect/disconnect
  - file:   file transfers to removable media

Unsupported event types (in current 3-source CyberDNA pipeline):
  - http:   web navigation / wikileaks uploads / job searches
  - email:  solicitation / supervisor mass broadcast emails
"""

import os
import csv
from typing import Dict, List, Any, Optional
from .config import SUPPORTED_DATA_SOURCES, UNSUPPORTED_DATA_SOURCES


class ObservablesParser:
    """
    Parses CERT r4.2 incident observables files with defensive error handling.
    """

    @staticmethod
    def parse_file(file_path: str) -> Dict[str, Any]:
        """
        Parses a single observables CSV file.
        Returns a dictionary containing:
          - events: list of parsed event dictionaries
          - event_counts_by_type: Dict[str, int]
          - total_events: int
          - supported_events: int
          - unsupported_events: int
          - supported_ratio: float
          - unique_pcs: List[str]
          - earliest_timestamp: str or None
          - latest_timestamp: str or None
          - key_evidence: List[Dict[str, str]]
        """
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"Observables file not found: {file_path}")

        events: List[Dict[str, Any]] = []
        event_counts: Dict[str, int] = {}
        unique_pcs = set()
        earliest_ts: Optional[str] = None
        latest_ts: Optional[str] = None

        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for line_idx, row in enumerate(reader, start=1):
                if not row or len(row) < 3:
                    continue

                event_type = row[0].strip().lower()
                event_counts[event_type] = event_counts.get(event_type, 0) + 1

                # Standard fields based on event type
                event_id = row[1].strip() if len(row) > 1 else ""
                event_date = row[2].strip() if len(row) > 2 else ""
                user = row[3].strip() if len(row) > 3 else ""
                pc = row[4].strip() if len(row) > 4 else ""

                if pc:
                    unique_pcs.add(pc)

                if event_date:
                    if earliest_ts is None:
                        earliest_ts = event_date
                    latest_ts = event_date

                # Extract specialized fields defensively
                extra_info: Dict[str, str] = {}
                if event_type in ("logon", "device"):
                    activity = row[5].strip() if len(row) > 5 else "Unknown"
                    extra_info["activity"] = activity
                elif event_type == "file":
                    filename = row[5].strip() if len(row) > 5 else "Unknown"
                    extra_info["filename"] = filename
                elif event_type == "http":
                    url = row[5].strip() if len(row) > 5 else "Unknown"
                    extra_info["url"] = url
                elif event_type == "email":
                    to_field = row[5].strip() if len(row) > 5 else ""
                    from_field = row[8].strip() if len(row) > 8 else ""
                    extra_info["to"] = to_field
                    extra_info["from"] = from_field

                parsed_record = {
                    "line_number": line_idx,
                    "event_type": event_type,
                    "event_id": event_id,
                    "date": event_date,
                    "user": user,
                    "pc": pc,
                    "is_supported": event_type in SUPPORTED_DATA_SOURCES,
                    **extra_info
                }
                events.append(parsed_record)

        total_events = len(events)
        supported_events = sum(1 for e in events if e["is_supported"])
        unsupported_events = total_events - supported_events
        supported_ratio = round(supported_events / total_events, 4) if total_events > 0 else 0.0

        # Extract representative key evidence highlights (up to 8 events)
        key_evidence = []
        for e in events[:8]:
            summary_str = f"[{e['event_type'].upper()}] {e.get('date', '')} on {e.get('pc', '')}"
            if "activity" in e:
                summary_str += f" ({e['activity']})"
            elif "filename" in e:
                summary_str += f" (File: {e['filename']})"
            elif "url" in e:
                summary_str += f" (URL: {e['url'][:45]}...)"
            elif "to" in e:
                summary_str += f" (To: {e['to'][:30]}...)"

            key_evidence.append({
                "event_type": e["event_type"],
                "date": e["date"],
                "pc": e["pc"],
                "summary": summary_str,
                "is_supported": e["is_supported"]
            })

        return {
            "file_name": os.path.basename(file_path),
            "total_events": total_events,
            "supported_events": supported_events,
            "unsupported_events": unsupported_events,
            "supported_ratio": supported_ratio,
            "event_counts_by_type": event_counts,
            "unique_pcs": sorted(list(unique_pcs)),
            "earliest_timestamp": earliest_ts,
            "latest_timestamp": latest_ts,
            "key_evidence": key_evidence,
            "events_sample": events[:20]  # sample of events for detail view
        }
