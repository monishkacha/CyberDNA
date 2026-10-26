"""
CyberDNA Evaluation Module - Configuration & Constants
======================================================
Defines paths, scenario definitions, supported vs. unsupported data sources,
and evaluation methodology metadata for CERT r4.2 evaluation.
"""

import os
from dataclasses import dataclass, field
from typing import Dict, List, Set, Any

# Base Directory Paths
_script_dir = os.path.dirname(os.path.abspath(__file__))
ANALYTICS_DIR = os.path.dirname(_script_dir)
REPO_ROOT = os.path.dirname(ANALYTICS_DIR)

DEFAULT_RAW_DIR = os.path.join(ANALYTICS_DIR, "datasets", "cert_r4.2", "raw", "r4.2")
DEFAULT_ANSWER_KEY_DIR = os.path.join(ANALYTICS_DIR, "datasets", "cert_r4.2", "answer_key", "answers")
DEFAULT_PIPELINE_OUTPUT_DIR = os.path.join(ANALYTICS_DIR, "output", "cert_r4.2")
DEFAULT_EVALUATION_OUTPUT_DIR = os.path.join(ANALYTICS_DIR, "output", "cert_r4.2", "evaluation")

# CERT Red Team Scenario Definitions
SCENARIO_DEFINITIONS = {
    1: {
        "title": "After-Hours USB Staging & WikiLeaks Exfiltration",
        "description": (
            "User who did not previously use removable drives or work after hours begins logging in after hours, "
            "using a removable drive, and uploading data to wikileaks.org. Leaves the organization shortly thereafter."
        ),
        "primary_threat_vector": "Data Exfiltration via Web / WikiLeaks preceded by after-hours USB collection",
        "supported_indicators": ["logon (after-hours)", "device (removable connect/disconnect)"],
        "unsupported_indicators": ["http (wikileaks.org upload)", "ldap (employment termination)"]
    },
    2: {
        "title": "Competitor Solicitation & High-Rate Thumb Drive Theft",
        "description": (
            "User begins surfing job websites and soliciting employment from a competitor. Before leaving the company, "
            "they use a thumb drive (at markedly higher rates than their previous activity) to steal data."
        ),
        "primary_threat_vector": "Intellectual Property Theft via Portable Storage following job-seeking activity",
        "supported_indicators": ["device (elevated thumb drive connects)", "file (bulk removable media copies)"],
        "unsupported_indicators": ["http (job websites browsing)", "email (competitor employment solicitation)"]
    },
    3: {
        "title": "Disgruntled Administrator Keylogger Installation & Impersonation",
        "description": (
            "System administrator becomes disgruntled. Downloads a keylogger and uses a thumb drive to transfer it to his "
            "supervisor's machine. The next day, he uses the collected keylogs to log in as his supervisor and send out an "
            "alarming mass email, causing panic in the organization. He leaves the organization immediately."
        ),
        "primary_threat_vector": "Privilege Abuse, Supervisor Machine Lateral Access & Panic Disruption",
        "supported_indicators": [
            "device (thumb drive staging on target machine)",
            "file (keylogger executable copy)",
            "logon (login on supervisor PC / cross-host logon)"
        ],
        "unsupported_indicators": ["http (keylogger download)", "email (mass panic broadcast email)"]
    }
}

# Supported vs Unsupported Data Sources in CyberDNA's Current 3-Source Engine
SUPPORTED_DATA_SOURCES: Set[str] = {"logon", "device", "file"}
UNSUPPORTED_DATA_SOURCES: Set[str] = {"http", "email", "ldap", "psychometric"}

# Working Hours Standard (Documented & Consistent with cert_pyspark_pipeline.py)
WORK_START_HOUR = 7
WORK_END_HOUR = 19
INCLUDE_WEEKENDS_AS_OFF_HOURS = True
