"""
CyberDNA Evaluation Module
==========================
Independent scientific evaluation engine for benchmarking CyberDNA detections
against the CMU/SEI CERT Insider Threat Dataset (Release 4.2).
"""

from .config import SCENARIO_DEFINITIONS, SUPPORTED_DATA_SOURCES, UNSUPPORTED_DATA_SOURCES
from .answer_key_loader import AnswerKeyLoader
from .observables_parser import ObservablesParser
from .evaluator import CertEvaluator
from .metrics import EvaluationMetrics
from .storage import EvaluationStorage

__all__ = [
    "SCENARIO_DEFINITIONS",
    "SUPPORTED_DATA_SOURCES",
    "UNSUPPORTED_DATA_SOURCES",
    "AnswerKeyLoader",
    "ObservablesParser",
    "CertEvaluator",
    "EvaluationMetrics",
    "EvaluationStorage"
]
