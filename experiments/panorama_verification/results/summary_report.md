# Continuous Sweep Verification Framework — Empirical Report

## 1. Executive Summary
- **Total Experimental Sweeps Evaluated**: 15
- **Automatically Verified (Present)**: 3 (20.0%)
- **Flagged for Lecturer Review**: 12 (80.0%)
- **Rejected**: 0 (0.0%)
- **Lecturer Optical Resolution FLAGGED Rate (Rule 7)**: **80.0%**

> [!IMPORTANT]
> In standard classroom configurations ($3\text{m}$ to $24\text{m}$), front-facing smartphone cameras yield an inter-pupillary distance (IPD) below the required $30\text{px}$ threshold beyond $3\text{m}$–$6\text{m}$.
> As required by the specification, the system flags these attempts for lecturer filmstrip review rather than auto-rejecting or making unverified positive claims.

## 2. Rule 7 (Lecturer Identification) Performance by Distance
| Distance (m) | Total Samples | Mean IPD (px) | Rule 7 FLAGGED Rate (%) | Overall Outcome |
| :--- | :--- | :--- | :--- | :--- |
| 3.0m | 3 | 72.4 px | 0.0% | Verified |
| 6.0m | 3 | 72.4 px | 100.0% | Flagged (Review Queue) |
| 12.0m | 3 | 72.4 px | 100.0% | Flagged (Review Queue) |
| 18.0m | 3 | 72.4 px | 100.0% | Flagged (Review Queue) |
| 24.0m | 3 | 72.4 px | 100.0% | Flagged (Review Queue) |

## 3. Performance by Device Tier
| Device Model Tier | Samples | Verified % | Flagged % | Avg Lecturer IPD |
| :--- | :--- | :--- | :--- | :--- |
| Budget_Android_A04 | 5 | 20.0% | 80.0% | 48.3 px |
| Flagship_S24Ultra | 5 | 20.0% | 80.0% | 96.6 px |
| MidRange_Pixel7a | 5 | 20.0% | 80.0% | 72.2 px |

## 4. Per-Rule Pass Rates (Whole Dataset)
- **Rule 1 (Auth & Time Window)**: 100.0%
- **Rule 2 (Limits & Idempotency)**: 100.0%
- **Rule 3 (Image Quality)**: 100.0%
- **Rule 4 (Sweep Duration & Monotonic Arc)**: 100.0%
- **Rule 5 (Self Reference Face Match)**: 100.0%
- **Rule 6 (Neighbour Face Detection)**: 100.0%
- **Rule 7 (Lecturer Detection & IPD >= 30px)**: 20.0% Pass / 80.0% FLAGGED
- **Rule 8 (Fraud & Media Duplication)**: 100.0%
