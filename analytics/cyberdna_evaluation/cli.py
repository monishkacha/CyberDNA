"""
CyberDNA Evaluation Module - Command Line Interface
===================================================
Executes the isolated scientific evaluation workflow:
  1. Validates CERT r4.2 insiders.csv ground-truth reference key
  2. Measures baseline employee-level macro-threshold overlap
  3. Re-computes time-window-aware activity metrics
  4. Matches incident detection rules and identifies missed/unsupported cases
  5. Exports evaluation_summary.json, incident_comparison.csv, scenario_summary.csv, etc.
  6. Attempts optional MongoDB Atlas upsert if configured.
"""

import os
import sys
import json
import argparse
import logging

# Ensure project directories are in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_analytics_dir = os.path.dirname(_current_dir)
_root_dir = os.path.dirname(_analytics_dir)
for p in [_current_dir, _analytics_dir, _root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from cyberdna_evaluation.config import (
    DEFAULT_RAW_DIR,
    DEFAULT_ANSWER_KEY_DIR,
    DEFAULT_PIPELINE_OUTPUT_DIR,
    DEFAULT_EVALUATION_OUTPUT_DIR
)
from cyberdna_evaluation.evaluator import CertEvaluator
from cyberdna_evaluation.storage import EvaluationStorage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("CyberDNA.Evaluation.CLI")


def run_evaluation(
    raw_dir: str = DEFAULT_RAW_DIR,
    answer_key_dir: str = DEFAULT_ANSWER_KEY_DIR,
    pipeline_output_dir: str = DEFAULT_PIPELINE_OUTPUT_DIR,
    output_dir: str = DEFAULT_EVALUATION_OUTPUT_DIR
) -> dict:
    """
    Runs the complete evaluation and persists outputs.
    """
    evaluator = CertEvaluator(
        raw_dir=raw_dir,
        answer_key_dir=answer_key_dir,
        pipeline_output_dir=pipeline_output_dir,
        evaluation_output_dir=output_dir
    )

    eval_data = evaluator.evaluate()

    storage = EvaluationStorage(output_dir=output_dir)
    persisted_paths = storage.persist_results(eval_data)
    eval_data["persisted_paths"] = persisted_paths

    return eval_data


def main():
    parser = argparse.ArgumentParser(
        description="CyberDNA CERT r4.2 Scientific Evaluation Runner"
    )
    parser.add_argument(
        "--raw-dir",
        default=DEFAULT_RAW_DIR,
        help="Path to raw CERT r4.2 data directory"
    )
    parser.add_argument(
        "--answer-key-dir",
        default=DEFAULT_ANSWER_KEY_DIR,
        help="Path to CERT answer_key/answers directory containing insiders.csv"
    )
    parser.add_argument(
        "--pipeline-output-dir",
        default=DEFAULT_PIPELINE_OUTPUT_DIR,
        help="Path to existing PySpark pipeline output directory containing alerts.parquet"
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_EVALUATION_OUTPUT_DIR,
        help="Target output directory for evaluation reports and comparison tables"
    )

    args = parser.parse_args()

    try:
        results = run_evaluation(
            raw_dir=os.path.abspath(args.raw_dir),
            answer_key_dir=os.path.abspath(args.answer_key_dir),
            pipeline_output_dir=os.path.abspath(args.pipeline_output_dir),
            output_dir=os.path.abspath(args.output_dir)
        )

        overall = results["metrics"]["overall"]
        print("\n=================================================================")
        print(" EVALUATION SUMMARY REPORT")
        print("=================================================================")
        print(f"Total Reference Incidents:    {overall['total_incidents']}")
        print(f"Baseline Employee Overlap:    {overall['baseline_overlap_count']}/70 ({overall['baseline_overlap_percentage']}%) [Preliminary Macro Diagnostic]")
        print(f"Window-Aware Detections:      {overall['window_detected_count']}/70 ({overall['detection_percentage']}%)")
        print(f"Window-Aware Missed:          {overall['window_missed_count']}/70")
        print(f"Observables Supported Ratio:  {overall['supported_observables']}/{overall['total_observables']} ({overall['observables_coverage_percentage']}%)")
        print("=================================================================\n")
        print(json.dumps({
            "status": "SUCCESS",
            "evaluation_id": results["evaluation_id"],
            "metrics": results["metrics"],
            "persisted_paths": results["persisted_paths"],
            "mongodb_status": results.get("mongodb_persistence", {}).get("status")
        }, indent=2))

    except Exception as e:
        logger.error(f"Evaluation failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
