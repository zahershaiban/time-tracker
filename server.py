#!/usr/bin/env python3
"""
Zero-setup local file + Google Drive for Desktop auto-save server for Time Tracker.
Uses Python standard library only.
"""

from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import string
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 8765
BASE_DIR = Path(__file__).resolve().parent
LOCAL_DATA_PATH = BASE_DIR / "data.json"
CONFIG_PATH = BASE_DIR / "config.json"


def load_custom_drive_path() -> Path | None:
    """Read optional config.json with {"drive_data_path": "..."}."""
    if not CONFIG_PATH.is_file():
        return None
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        custom = raw.get("drive_data_path") if isinstance(raw, dict) else None
        if isinstance(custom, str) and custom.strip():
            p = Path(custom.strip()).expanduser()
            if p.suffix.lower() != ".json":
                p = p / "data.json"
            return p
    except Exception:
        return None
    return None


def detect_drive_data_path() -> Path | None:
    """Auto-detect Google Drive for Desktop mount or custom config.json path."""
    custom = load_custom_drive_path()
    if custom is not None:
        return custom

    # Check drive letters D: through Z: for "<Drive>:\My Drive"
    for letter in string.ascii_uppercase[3:]:
        candidate = Path(f"{letter}:\\My Drive")
        try:
            if candidate.is_dir():
                return candidate / "Time Tracking" / "data.json"
        except OSError:
            continue

    # Fallback: %USERPROFILE%\Google Drive
    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        candidate = Path(user_profile) / "Google Drive"
        try:
            if candidate.is_dir():
                return candidate / "Time Tracking" / "data.json"
        except OSError:
            pass

    return None


def read_json_file(path: Path | None) -> dict | None:
    if not path or not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def atomic_write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(path.name + ".tmp")
    content = json.dumps(payload, indent=2, ensure_ascii=False)
    tmp_path.write_text(content, encoding="utf-8")
    os.replace(tmp_path, path)


def session_timestamp(s: dict) -> float:
    return float(s.get("updatedAt") or s.get("createdAt") or 0)


def pick_newest_field(
    local_data: dict | None,
    drive_data: dict | None,
    field: str,
    ts_field: str,
    expected_type: type,
    local_mtime: float,
    drive_mtime: float,
):
    local_val = local_data.get(field) if isinstance(local_data, dict) and isinstance(local_data.get(field), expected_type) else None
    drive_val = drive_data.get(field) if isinstance(drive_data, dict) and isinstance(drive_data.get(field), expected_type) else None
    local_ts = float(local_data.get(ts_field) or 0) if isinstance(local_data, dict) else 0.0
    drive_ts = float(drive_data.get(ts_field) or 0) if isinstance(drive_data, dict) else 0.0

    if local_val is not None and drive_val is not None:
        if drive_ts > local_ts or (drive_ts == local_ts and drive_mtime > local_mtime):
            return drive_val, drive_ts
        return local_val, local_ts
    if drive_val is not None:
        return drive_val, drive_ts
    if local_val is not None:
        return local_val, local_ts
    return None, 0.0


def merge_datasets(local_data: dict | None, drive_data: dict | None, local_mtime: float, drive_mtime: float) -> dict:
    """Merge sessions by unique id (keeping newest), plus newest goals & categories."""
    by_id: dict[str, dict] = {}

    for source in (local_data, drive_data):
        if not isinstance(source, dict):
            continue
        sessions = source.get("sessions")
        if not isinstance(sessions, list):
            continue
        for item in sessions:
            if not isinstance(item, dict) or not item.get("id"):
                continue
            sid = str(item["id"])
            existing = by_id.get(sid)
            if existing is None or session_timestamp(item) > session_timestamp(existing):
                by_id[sid] = item

    merged_sessions = sorted(
        by_id.values(),
        key=lambda s: (str(s.get("date", "")), float(s.get("createdAt") or 0)),
        reverse=True,
    )

    merged_goals, merged_goals_ts = pick_newest_field(
        local_data, drive_data, "goals", "goalsUpdatedAt", dict, local_mtime, drive_mtime
    )
    merged_cats, merged_cats_ts = pick_newest_field(
        local_data, drive_data, "categories", "categoriesUpdatedAt", list, local_mtime, drive_mtime
    )

    result = {
        "version": 2,
        "sessions": merged_sessions,
        "goalsUpdatedAt": merged_goals_ts,
        "categoriesUpdatedAt": merged_cats_ts,
    }
    if merged_goals is not None:
        result["goals"] = merged_goals
    if merged_cats is not None:
        result["categories"] = merged_cats
    return result


class TimeTrackerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/data":
            self.handle_get_data()
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/data":
            self.handle_post_data()
            return
        self.send_json(404, {"ok": False, "error": "Not found"})

    def handle_get_data(self) -> None:
        drive_path = detect_drive_data_path()
        local_data = read_json_file(LOCAL_DATA_PATH)
        drive_data = read_json_file(drive_path) if drive_path else None

        local_mtime = LOCAL_DATA_PATH.stat().st_mtime if LOCAL_DATA_PATH.is_file() else 0.0
        drive_mtime = drive_path.stat().st_mtime if (drive_path and drive_path.is_file()) else 0.0

        merged = merge_datasets(local_data, drive_data, local_mtime, drive_mtime)
        merged["storage"] = {
            "localPath": str(LOCAL_DATA_PATH),
            "drivePath": str(drive_path) if drive_path else None,
            "driveSynced": bool(drive_path),
        }
        self.send_json(200, merged)

    def handle_post_data(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            body = json.loads(raw.decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("JSON body must be an object")
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": f"Invalid JSON: {exc}"})
            return

        sessions = body.get("sessions", [])
        if not isinstance(sessions, list):
            self.send_json(400, {"ok": False, "error": "'sessions' must be a list"})
            return

        payload = {
            "version": int(body.get("version", 2)),
            "savedAt": datetime.now(timezone.utc).isoformat(),
            "sessions": sessions,
            "goalsUpdatedAt": body.get("goalsUpdatedAt", 0),
            "categoriesUpdatedAt": body.get("categoriesUpdatedAt", 0),
        }
        if isinstance(body.get("goals"), dict):
            payload["goals"] = body["goals"]
        if isinstance(body.get("categories"), list):
            payload["categories"] = body["categories"]

        try:
            atomic_write_json(LOCAL_DATA_PATH, payload)
        except Exception as exc:
            self.send_json(500, {"ok": False, "error": f"Failed to write local data.json: {exc}"})
            return

        drive_path = detect_drive_data_path()
        drive_synced = False
        if drive_path is not None:
            try:
                atomic_write_json(drive_path, payload)
                drive_synced = True
            except Exception:
                drive_synced = False

        self.send_json(
            200,
            {
                "ok": True,
                "savedAt": payload["savedAt"],
                "storage": {
                    "localPath": str(LOCAL_DATA_PATH),
                    "drivePath": str(drive_path) if drive_path else None,
                    "driveSynced": drive_synced,
                },
            },
        )

    def log_message(self, format: str, *args) -> None:
        if args and "/api/data" in str(args[0]):
            return
        super().log_message(format, *args)


def main() -> None:
    drive_path = detect_drive_data_path()
    print("==================================================")
    print("  Time Tracker — Local + Google Drive Auto-Save")
    print("==================================================")
    print(f"  URL:        http://localhost:{PORT}")
    print(f"  Local file: {LOCAL_DATA_PATH}")
    if drive_path:
        print(f"  Drive sync: {drive_path} (DETECTED)")
    else:
        print("  Drive sync: Not detected (saving locally to data.json)")
    print("  Press Ctrl+C to stop.")
    print("==================================================")

    server = ThreadingHTTPServer((HOST, PORT), TimeTrackerHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Time Tracker server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
