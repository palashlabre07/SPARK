#!/usr/bin/env python3
"""
SPARK — YOLO Occupancy Agent
════════════════════════════
Uses Ultralytics YOLOv8 + OpenCV to count people in a camera feed.
Pushes readings and alerts to Supabase in real time.

Setup:
    pip install ultralytics opencv-python-headless psycopg2-binary python-dotenv requests

Run:
    python yolo_agent.py --zone lab --campus main

    # Custom camera (RTSP stream):
    python yolo_agent.py --zone lab --source rtsp://user:pass@192.168.1.100:554/stream

    # Test with a video file:
    python yolo_agent.py --zone lab --source path/to/clip.mp4
"""

import os
import sys
import time
import json
import argparse
import datetime
import traceback
from pathlib import Path

# ── Load .env ────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    # Load from spark-app/.env (this script lives one level above spark-app)
    env_path = Path(__file__).parent / "spark-app" / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv()  # fallback: .env in cwd
except ImportError:
    print("[SPARK] python-dotenv not installed; reading env vars from shell.")

# ── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL  = os.getenv("VITE_SUPABASE_URL",  "https://dvujisiunmerilnhsmft.supabase.co")
SUPABASE_KEY  = os.getenv("VITE_SUPABASE_ANON_KEY", "")
DATABASE_URL  = os.getenv("DATABASE_URL", "")
YOLO_MODEL    = os.getenv("YOLO_MODEL",   "yolov8n.pt")
CAM_SOURCE    = os.getenv("CAMERA_SOURCE", "0")

AFTER_HOURS_START = int(os.getenv("AFTER_HOURS_START", "22"))
AFTER_HOURS_END   = int(os.getenv("AFTER_HOURS_END",   "5"))
EMPTY_ALERT_SEC   = int(os.getenv("EMPTY_ALERT_THRESHOLD_SEC", "120"))

# Detection config
CONF_THRESHOLD    = 0.4    # minimum YOLO confidence to count a detection
PERSON_CLASS_ID   = 0      # COCO class 0 = person
SAVE_ALERT_FRAMES = True   # save a JPEG whenever an alert fires
FRAME_SAVE_DIR    = Path("alert_frames")
PUSH_INTERVAL_SEC = 30     # push a reading to Supabase every N seconds

# ── Supabase REST helper ─────────────────────────────────────────────────────
import urllib.request
import urllib.error

def _sb_headers():
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }

def _sb_post(table: str, payload: dict) -> bool:
    """Insert one row via Supabase REST API. Returns True on success."""
    if not SUPABASE_KEY:
        print(f"[SPARK] ⚠ No SUPABASE_KEY — skipping DB push for {table}")
        return False
    url  = f"{SUPABASE_URL}/rest/v1/{table}"
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(url, data=data, headers=_sb_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status in (200, 201)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[SPARK] DB error {e.code} on {table}: {body[:200]}")
        return False
    except Exception as e:
        print(f"[SPARK] DB connection error: {e}")
        return False

def push_reading(zone_id: str, campus_id: str, people: int, confidence: float, ts: str) -> bool:
    h = int(ts[11:13])
    is_ah = (h >= AFTER_HOURS_START) or (h < AFTER_HOURS_END)
    return _sb_post("occupancy_readings", {
        "zone_id":       zone_id,
        "campus_id":     campus_id,
        "ts":            ts,
        "people":        people,
        "source":        "yolo",
        "confidence":    round(confidence, 3),
        "is_after_hours": is_ah,
    })

def push_alert(zone_id: str, campus_id: str, alert_type: str,
               severity: str, people: int, message: str) -> bool:
    return _sb_post("occupancy_alerts", {
        "zone_id":      zone_id,
        "campus_id":    campus_id,
        "alert_type":   alert_type,
        "severity":     severity,
        "people_count": people,
        "message":      message,
        "ts":           datetime.datetime.now(datetime.timezone.utc).isoformat(),
    })

# ── Also write JSONL log (compatible with the manual import UI) ───────────────
LOG_FILE = Path("occupancy.jsonl")

def log_jsonl(zone_id: str, people: int, ts: str):
    record = {"zone": zone_id, "ts": ts, "people": people, "source": "yolo"}
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

# ── Main agent ───────────────────────────────────────────────────────────────
def run_agent(zone_id: str, campus_id: str, source, show_window: bool):
    # ── Imports (lazy — allows import errors to surface cleanly) ─────────────
    try:
        import cv2
    except ImportError:
        print("❌ OpenCV not installed. Run: pip install opencv-python-headless")
        sys.exit(1)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ Ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    print(f"[SPARK] Loading YOLO model: {YOLO_MODEL}")
    model = YOLO(YOLO_MODEL)  # auto-downloads on first run
    print(f"[SPARK] Model ready. Connecting to camera source: {source}")

    # ── Open camera ──────────────────────────────────────────────────────────
    cap_source = int(source) if str(source).isdigit() else source
    cap = cv2.VideoCapture(cap_source)
    if not cap.isOpened():
        print(f"❌ Cannot open camera source: {source}")
        print("   Try: --source 0  (default webcam) or an RTSP URL")
        sys.exit(1)

    print(f"[SPARK] ✓ Camera open. Zone={zone_id}, Campus={campus_id}")
    print(f"[SPARK] Pushing readings every {PUSH_INTERVAL_SEC}s. Press Ctrl+C to stop.")
    print()

    FRAME_SAVE_DIR.mkdir(exist_ok=True)

    # State
    last_push_time       = time.time()
    empty_since          = None           # time when people count first became 0
    alert_cooldown_until = 0             # don't re-alert before this time

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[SPARK] ⚠ Frame read failed — waiting 2s")
                time.sleep(2)
                continue

            # ── Run YOLO inference ───────────────────────────────────────────
            results = model(frame, verbose=False, classes=[PERSON_CLASS_ID], conf=CONF_THRESHOLD)
            detections = results[0].boxes if results and results[0].boxes else []
            people_count  = len(detections)
            max_conf      = max((float(b.conf[0]) for b in detections), default=0.0)

            now     = datetime.datetime.now(datetime.timezone.utc)
            now_str = now.isoformat()
            hour    = now.hour
            is_after_hours = (hour >= AFTER_HOURS_START) or (hour < AFTER_HOURS_END)

            # ── Draw boxes ──────────────────────────────────────────────────
            if show_window:
                annotated = results[0].plot()
                colour = (0, 200, 0) if people_count > 0 else (0, 0, 220)
                label  = f"Zone: {zone_id}  People: {people_count}"
                cv2.putText(annotated, label, (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, colour, 2)
                if is_after_hours:
                    cv2.putText(annotated, "AFTER HOURS", (10, 65),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
                cv2.imshow(f"SPARK YOLO — {zone_id}", annotated)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("[SPARK] 'q' pressed — stopping.")
                    break

            # ── Alert logic: EMPTY ROOM WARNING ─────────────────────────────
            if people_count == 0:
                if empty_since is None:
                    empty_since = time.time()
                    print(f"[SPARK] ⚠  No person detected in {zone_id} at {now_str[:19]}")

                empty_duration = time.time() - empty_since

                if empty_duration >= EMPTY_ALERT_SEC and time.time() > alert_cooldown_until:
                    sev = "High" if is_after_hours else "Medium"
                    msg = (
                        f"Zone '{zone_id}' has had 0 people for "
                        f"{int(empty_duration)}s "
                        f"({'after hours' if is_after_hours else 'working hours'}). "
                        f"Possible lights/equipment left on in an empty room."
                    )
                    print(f"\n{'='*60}")
                    print(f"  🚨 ALERT [{sev}] — {zone_id}")
                    print(f"  {msg}")
                    print(f"{'='*60}\n")

                    # Save alert frame
                    if SAVE_ALERT_FRAMES:
                        fname = FRAME_SAVE_DIR / f"{zone_id}_{now.strftime('%Y%m%d_%H%M%S')}.jpg"
                        cv2.imwrite(str(fname), frame)
                        print(f"[SPARK] Alert frame saved: {fname}")

                    # Push to Supabase
                    alert_type = "EMPTY_ROOM_POWER_ON" if is_after_hours else "NO_DETECTION"
                    ok = push_alert(zone_id, campus_id, alert_type, sev, 0, msg)
                    if ok:
                        print(f"[SPARK] ✓ Alert pushed to Supabase")
                    else:
                        print(f"[SPARK] ⚠ Alert NOT pushed (DB unavailable) — check .env")

                    alert_cooldown_until = time.time() + 300  # 5-min cooldown
            else:
                if empty_since is not None:
                    print(f"[SPARK] ✓ Person detected again in {zone_id}: count={people_count}")
                empty_since = None  # reset

            # ── Periodic reading push ────────────────────────────────────────
            if time.time() - last_push_time >= PUSH_INTERVAL_SEC:
                ok = push_reading(zone_id, campus_id, people_count, max_conf, now_str)
                log_jsonl(zone_id, people_count, now_str)
                status = "✓" if ok else "⚠(offline)"
                print(f"[SPARK] [{now_str[:19]}] zone={zone_id} people={people_count} "
                      f"conf={max_conf:.2f} {'AFTER_HOURS' if is_after_hours else ''} db={status}")
                last_push_time = time.time()

    except KeyboardInterrupt:
        print("\n[SPARK] Stopped by user.")
    finally:
        cap.release()
        if show_window:
            cv2.destroyAllWindows()
        print(f"[SPARK] JSONL log saved to: {LOG_FILE}")


# ── CLI ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="SPARK YOLO Person Detection Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python yolo_agent.py --zone lab
  python yolo_agent.py --zone lib --source rtsp://cam.example.com/stream1
  python yolo_agent.py --zone aud --source test_clip.mp4 --no-window
  python yolo_agent.py --zone can --campus eng --model yolov8s.pt
        """
    )
    parser.add_argument("--zone",      default="lab",   help="Zone ID (lab, lib, host, can, aud, pump)")
    parser.add_argument("--campus",    default="main",  help="Campus ID (main, eng, hostel)")
    parser.add_argument("--source",    default=None,    help="Camera source (0=webcam, RTSP URL, or video file)")
    parser.add_argument("--model",     default=None,    help="YOLO model file e.g. yolov8s.pt")
    parser.add_argument("--no-window", action="store_true", help="Disable OpenCV display window (headless mode)")
    args = parser.parse_args()

    # Overrides from args
    if args.source: CAM_SOURCE = args.source
    if args.model:  YOLO_MODEL = args.model

    run_agent(
        zone_id     = args.zone,
        campus_id   = args.campus,
        source      = CAM_SOURCE,
        show_window = not args.no_window,
    )
