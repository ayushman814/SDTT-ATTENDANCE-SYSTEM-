"""Test for continuous sweep panorama verification experiment script."""
import sys
from pathlib import Path

# Add experiments/panorama_verification to path
EXP_DIR = Path(__file__).resolve().parents[2] / "experiments" / "panorama_verification"
sys.path.insert(0, str(EXP_DIR))

import run_panorama_verification


def test_panorama_verification_runner(tmp_path):
    out_csv = tmp_path / "test_results.csv"
    report_md = tmp_path / "test_report.md"

    records = run_panorama_verification.run_sweep_evaluation(
        manifest_path=None,  # Uses synthetic matrix
        output_csv_path=out_csv,
        report_md_path=report_md,
    )

    assert len(records) > 0
    assert out_csv.exists()
    assert report_md.exists()

    # Verify report contains Rule 7 FLAGGED rate metric
    with open(report_md, "r", encoding="utf-8") as f:
        content = f.read()
        assert "Lecturer Optical Resolution FLAGGED Rate (Rule 7)" in content
        assert "Rule 7 (Lecturer Identification) Performance by Distance" in content
