"""Render a self-contained Attendrix product walkthrough video.

This renderer is intentionally independent of the web toolchain so a preview
can still be delivered on machines without Node.js or a browser automation
runtime. All operational values shown here are labelled illustrative.
"""
from __future__ import annotations

import math
from pathlib import Path
from textwrap import wrap

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "attendrix_product_walkthrough.mp4"
WIDTH, HEIGHT, FPS = 1280, 720, 24
FONT = cv2.FONT_HERSHEY_DUPLEX
MONO = cv2.FONT_HERSHEY_COMPLEX_SMALL


def clamp(value: float) -> int:
    return max(0, min(255, int(value)))


def background(frame: np.ndarray, progress: float) -> None:
    for y in range(HEIGHT):
        blend = y / HEIGHT
        frame[y, :, :] = (int(14 + 18 * blend), int(24 + 24 * blend), int(31 + 32 * blend))
    overlay = frame.copy()
    cv2.circle(overlay, (int(980 + math.sin(progress * math.pi * 2) * 90), 140), 260, (24, 88, 88), -1)
    cv2.circle(overlay, (180, int(560 + math.cos(progress * math.pi * 2) * 50)), 220, (48, 55, 92), -1)
    cv2.addWeighted(overlay, 0.22, frame, 0.78, 0, frame)


def text(frame: np.ndarray, value: str, origin: tuple[int, int], size: float = 1.0, color=(235, 245, 242), thickness=1, font=FONT) -> None:
    cv2.putText(frame, value, origin, font, size, color, thickness, cv2.LINE_AA)


def rounded_rect(frame: np.ndarray, bounds: tuple[int, int, int, int], radius: int, color: tuple[int, int, int], thickness: int = -1) -> None:
    x1, y1, x2, y2 = bounds
    cv2.rectangle(frame, (x1 + radius, y1), (x2 - radius, y2), color, thickness)
    cv2.rectangle(frame, (x1, y1 + radius), (x2, y2 - radius), color, thickness)
    for centre in ((x1 + radius, y1 + radius), (x2 - radius, y1 + radius), (x1 + radius, y2 - radius), (x2 - radius, y2 - radius)):
        cv2.circle(frame, centre, radius, color, thickness)


def wrapped(frame: np.ndarray, value: str, x: int, y: int, width: int, size: float = 0.62, color=(180, 198, 198), line_height=28) -> int:
    lines = wrap(value, width=width)
    for index, line in enumerate(lines):
        text(frame, line, (x, y + index * line_height), size, color)
    return y + len(lines) * line_height


def pill(frame: np.ndarray, label: str, x: int, y: int, color: tuple[int, int, int]) -> None:
    width = max(140, len(label) * 10 + 28)
    rounded_rect(frame, (x, y, x + width, y + 34), 17, color)
    text(frame, label, (x + 14, y + 23), 0.52, (245, 250, 248), 1, MONO)


def panel(frame: np.ndarray, x: int, y: int, w: int, h: int, accent=(71, 196, 171)) -> None:
    rounded_rect(frame, (x, y, x + w, y + h), 20, (25, 40, 47))
    rounded_rect(frame, (x, y, x + w, y + h), 20, accent, 1)


def lecture_hall(frame: np.ndarray, progress: float) -> None:
    panel(frame, 640, 120, 520, 470, (71, 196, 171))
    text(frame, "ILLUSTRATIVE LECTURE HALL VIEW", (675, 160), 0.62, (152, 221, 205), 1, MONO)
    for row in range(10):
        y = 215 + row * 32
        scale = 1 + row * 0.035
        for col in range(16):
            x = int(700 + col * 27 * scale - row * 11)
            active = (row * 16 + col) / 160 <= min(1, progress * 1.45)
            color = (71, 196, 171) if active else (70, 86, 91)
            radius = max(3, int(4 * scale))
            cv2.circle(frame, (x, y), radius, color, -1)
            if active and (row + col) % 5 == 0:
                cv2.circle(frame, (x, y), radius + 5, (71, 196, 171), 1)
    cv2.rectangle(frame, (825, 485, 995, 525), (50, 71, 74), -1)
    text(frame, "STAGE / CONTEXT", (842, 510), 0.45, (210, 224, 219), 1, MONO)


def evidence_card(frame: np.ndarray, x: int, y: int, title: str, status: str, description: str, color: tuple[int, int, int]) -> None:
    panel(frame, x, y, 330, 180, color)
    text(frame, title, (x + 22, y + 38), 0.68, (238, 248, 245), 1)
    pill(frame, status, x + 20, y + 58, color)
    wrapped(frame, description, x + 22, y + 120, 29, 0.48, (176, 198, 196), 21)


def dashboard_mock(frame: np.ndarray, progress: float) -> None:
    panel(frame, 620, 100, 555, 505, (71, 196, 171))
    text(frame, "TEACHER CONTROL CENTER", (650, 140), 0.66, (152, 221, 205), 1, MONO)
    metrics = [("PRESENT", "184", (71, 196, 171)), ("PENDING", "12", (215, 164, 84)), ("REJECTED", "6", (203, 104, 97))]
    for i, (label, value, color) in enumerate(metrics):
        x = 650 + i * 165
        rounded_rect(frame, (x, 170, x + 145, 250), 12, (35, 54, 59))
        text(frame, label, (x + 14, 199), 0.38, (151, 176, 174), 1, MONO)
        text(frame, value, (x + 14, 235), 1.15, color, 2)
    text(frame, "Verification review queue", (650, 290), 0.58, (238, 248, 245), 1)
    for i in range(5):
        y = 320 + i * 42
        cv2.line(frame, (650, y + 22), (1135, y + 22), (57, 77, 80), 1)
        cv2.circle(frame, (668, y + 10), 8, (215, 164, 84) if i < 2 else (71, 196, 171), -1)
        text(frame, f"Student record {i + 1:02d}", (690, y + 16), 0.46, (203, 220, 216), 1)
        text(frame, "Review" if i < 2 else "Recorded", (1030, y + 16), 0.43, (215, 164, 84) if i < 2 else (71, 196, 171), 1, MONO)
    chart_x, chart_y = 670, 565
    points = []
    for i in range(12):
        px = chart_x + i * 36
        py = chart_y - int((20 + math.sin(i * 0.6 + progress * 5) * 15 + i * 2))
        points.append((px, py))
    cv2.polylines(frame, [np.asarray(points)], False, (71, 196, 171), 2, cv2.LINE_AA)


def architecture(frame: np.ndarray, progress: float) -> None:
    nodes = [(690, 180, "Flutter app", (71, 196, 171)), (960, 180, "React dashboard", (109, 170, 215)), (820, 340, "FastAPI", (215, 164, 84)), (690, 500, "PostgreSQL", (157, 132, 208)), (960, 500, "Vision workers", (203, 104, 97))]
    for start, end in [((745, 210), (820, 340)), ((1015, 210), (820, 340)), ((820, 390), (745, 500)), ((820, 390), (1015, 500))]:
        cv2.line(frame, start, end, (81, 112, 113), 2)
        t = (progress * 2.5) % 1
        x = int(start[0] + (end[0] - start[0]) * t)
        y = int(start[1] + (end[1] - start[1]) * t)
        cv2.circle(frame, (x, y), 6, (71, 196, 171), -1)
    for x, y, label, color in nodes:
        cv2.circle(frame, (x, y), 62, (27, 44, 50), -1)
        cv2.circle(frame, (x, y), 62, color, 2)
        text(frame, label, (x - len(label) * 4, y + 5), 0.48, (236, 246, 242), 1, MONO)


def render() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError("OpenCV could not create the MP4 encoder")
    scenes = [
        ("ATTENDRIX", "Computer-vision-assisted attendance for modern lecture halls.", "A working product ecosystem: Flutter student app, FastAPI service, React dashboard, and interactive presentation."),
        ("THE PROBLEM", "Large rooms make manual roll call slow and proxy-resistant evidence difficult.", "Attendrix keeps the official registry, session timing, evidence review, and corrections in one auditable workflow."),
        ("THE WORKFLOW", "Enrollment → session window → guided capture → server evaluation → teacher review.", "The student uses real front and rear camera capture. The backend remains authoritative for attendance state."),
        ("THREE EVIDENCE CATEGORIES", "Identity, liveness, and classroom context remain separate.", "CONFIRMED requires all configured checks. Missing models or insufficient evidence become PENDING_REVIEW."),
        ("TEACHER CONTROL CENTER", "Review uncertainty before finalizing the record.", "Illustrative interface: session metrics, review queue, manual decisions, audit history, and real XLSX exports."),
        ("ACTUAL ARCHITECTURE", "Flutter + React/Vite + FastAPI + PostgreSQL + protected vision workers.", "Private evidence storage, encrypted face representations, role-based authorization, and server-time session controls."),
        ("RESPONSIBLE ATTENDANCE", "Evidence helps review; it does not prove perfect presence or spoof resistance.", "Attendrix preserves manual correction, explicit reasons, retention controls, and clear pending outcomes."),
    ]
    frames_per_scene = FPS * 5
    total = frames_per_scene * len(scenes)
    for index in range(total):
        scene_index = min(len(scenes) - 1, index // frames_per_scene)
        local = (index % frames_per_scene) / frames_per_scene
        title, subtitle, body = scenes[scene_index]
        frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
        background(frame, (index / total))
        fade = min(1.0, local * 7, (1 - local) * 7)
        text(frame, "ATTENDRIX / PRODUCT WALKTHROUGH", (70, 62), 0.48, (112, 180, 170), 1, MONO)
        text(frame, title, (70, 170), 1.55, (235, 247, 242), 2)
        wrapped(frame, subtitle, 75, 225, 36, 0.72, (154, 224, 207), 32)
        wrapped(frame, body, 75, 330, 35, 0.58, (182, 200, 199), 28)
        if scene_index == 0:
            lecture_hall(frame, local)
        elif scene_index == 1:
            lecture_hall(frame, local * 0.5)
            text(frame, "240-seat context", (700, 565), 0.55, (215, 164, 84), 1, MONO)
        elif scene_index == 2:
            for step, label in enumerate(["ENROLL", "OPEN", "CAPTURE", "EVALUATE", "REVIEW"]):
                x = 675 + step * 92
                active = step <= int(local * 5.2)
                cv2.circle(frame, (x, 340), 26, (71, 196, 171) if active else (67, 83, 88), -1)
                text(frame, str(step + 1), (x - 7, 348), 0.55, (15, 35, 35), 1, MONO)
                text(frame, label, (x - 28, 395), 0.34, (195, 215, 210), 1, MONO)
                if step < 4: cv2.line(frame, (x + 28, 340), (x + 65, 340), (87, 128, 126), 2)
        elif scene_index == 3:
            evidence_card(frame, 620, 130, "IDENTITY", "CONFIGURED", "Encrypted enrollment comparison; score is model output, not a validated universal threshold.", (71, 196, 171))
            evidence_card(frame, 620, 335, "LIVENESS", "GUIDED", "Head movement and blink challenge; heuristic evidence, not perfect spoof protection.", (215, 164, 84))
            evidence_card(frame, 620, 540, "CONTEXT", "PRIVATE IMAGE", "Rear-camera classroom evidence is contextual and reviewable.", (109, 170, 215))
        elif scene_index == 4:
            dashboard_mock(frame, local)
        elif scene_index == 5:
            architecture(frame, local)
        else:
            panel(frame, 640, 130, 510, 420, (71, 196, 171))
            for row, label in enumerate(["Role-based access", "Encrypted representations", "Private evidence storage", "Audited corrections", "Pending review path"]):
                y = 190 + row * 63
                cv2.circle(frame, (690, y), 12, (71, 196, 171), -1)
                text(frame, "✓", (682, y + 7), 0.55, (15, 35, 35), 1, MONO)
                text(frame, label, (720, y + 8), 0.62, (227, 240, 235), 1)
        text(frame, "Illustrative presentation data • interactive website is the source of truth", (70, 665), 0.42, (118, 146, 145), 1, MONO)
        writer.write(frame)
    writer.release()
    print(OUTPUT)


if __name__ == "__main__":
    render()
