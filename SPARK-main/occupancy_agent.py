#!/usr/bin/env python3
"""SPARK occupancy agent: counts people in a CCTV stream with OpenCV + YOLO.

Runs on a small computer next to the camera. Only people COUNTS are written.
No frames, faces or identities are stored or sent.

Install:  pip install ultralytics opencv-python
Run:      python occupancy_agent.py --source rtsp://user:pass@192.168.1.20/stream1 --zone lab
Output:   occupancy.jsonl, one line per sample, e.g.
          {"zone": "lab", "ts": "2026-10-12T23:00:05", "people": 0, "source": "yolo"}
Paste the lines into SPARK > Energy management > Camera occupancy > Load camera counts.
Zone ids used by SPARK: lab, lib, host, can, aud, pump
"""
import argparse
import json
import statistics
import time
from datetime import datetime

import cv2
import numpy as np
from ultralytics import YOLO


def parse_roi(text):
    """'x1,y1;x2,y2;x3,y3;...' -> polygon of the area to count (optional)."""
    if not text:
        return None
    pts = [tuple(int(v) for v in p.split(",")) for p in text.split(";")]
    return np.array(pts, dtype="int32").reshape(-1, 1, 2)


def in_roi(box, roi):
    if roi is None:
        return True
    x1, y1, x2, y2 = box
    foot = (float((x1 + x2) / 2), float(y2))  # bottom-centre of the person box
    return cv2.pointPolygonTest(roi, foot, False) >= 0


def count_people(model, frame, conf, roi):
    result = model(frame, classes=[0], conf=conf, verbose=False)[0]  # class 0 = person
    return sum(1 for b in result.boxes.xyxy.tolist() if in_roi(b, roi))


def open_stream(source):
    cap = cv2.VideoCapture(int(source) if source.isdigit() else source)
    return cap if cap.isOpened() else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", required=True, help="RTSP/HTTP URL, video file, or webcam index")
    ap.add_argument("--zone", required=True, help="SPARK zone id, e.g. lab")
    ap.add_argument("--out", default="occupancy.jsonl")
    ap.add_argument("--interval", type=int, default=60, help="seconds between samples")
    ap.add_argument("--model", default="yolov8n.pt", help="small, CPU-friendly YOLO model")
    ap.add_argument("--conf", type=float, default=0.4)
    ap.add_argument("--roi", default="", help="optional polygon 'x1,y1;x2,y2;...' to count only inside it")
    ap.add_argument("--once", action="store_true", help="take one sample and exit (for testing)")
    args = ap.parse_args()

    model = YOLO(args.model)
    roi = parse_roi(args.roi)
    cap = None

    while True:
        started = time.time()
        if cap is None:
            cap = open_stream(args.source)
        counts = []
        if cap is not None:
            for _ in range(3):  # 3 frames, 1 s apart; the median reduces flicker
                ok, frame = cap.read()
                if not ok:
                    cap.release()
                    cap = None
                    break
                counts.append(count_people(model, frame, args.conf, roi))
                time.sleep(1)
        if counts:
            row = {
                "zone": args.zone,
                "ts": datetime.now().isoformat(timespec="seconds"),
                "people": int(statistics.median(counts)),
                "source": "yolo",
            }
            with open(args.out, "a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
            print(row, flush=True)
        else:
            print("No frame received. Will retry.", flush=True)
        if args.once:
            break
        time.sleep(max(0, args.interval - (time.time() - started)))


if __name__ == "__main__":
    main()
