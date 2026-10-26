# Continuous Sweep Verification Framework (Experiments)

This experimental framework evaluates the 9-rule front-camera continuous sweep attendance pipeline across smartphone device tiers (Device A: Entry-level budget Android, Device B: Mid-range, Device C: Flagship) under varying classroom distances ($3\text{m}$ to $24\text{m}$) and lighting conditions.

## Privacy & Consent
- **NO REAL PHOTOS COMMITTED**: In accordance with `Agents.md` and research ethics, raw photographs are stored locally in `data/raw/` (ignored by `.gitignore`) and never committed.
- All testing on volunteers requires explicit written consent.

## Metrics & Outputs
- **Per-Rule Pass Rate**: Detailed breakdown across Rules 1–8.
- **Lecturer FLAGGED Rate**: Quantifies the proportion of attempts where a person was detected on stage but front-camera optical resolution was insufficient for positive identity matching ($\text{IPD} < 30\text{px}$), resulting in a `FLAGGED` state rather than automatic pass or reject.
- **Device-Tier Comparison**: Analyzes performance differences across camera sensors.

## Usage
```bash
# Run against manifest
python experiments/panorama_verification/run_panorama_verification.py \
    --manifest experiments/panorama_verification/manifest.example.csv \
    --output experiments/panorama_verification/results/raw_results.csv \
    --report experiments/panorama_verification/results/summary_report.md

# Run synthetic validation benchmark (for CI / automated testing)
python experiments/panorama_verification/run_panorama_verification.py --synthetic
```
