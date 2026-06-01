#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

try:
    import yaml
except Exception:
    yaml = None


def fail(msg: str) -> None:
    print(msg)
    raise SystemExit(1)


def validate_exceptions(path: Path) -> None:
    if yaml is None:
        fail("PyYAML is required for security exception validation")
    if not path.exists():
        fail(f"Missing exceptions file: {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    items = data.get("exceptions", [])
    today = date.today()
    for item in items:
        for key in ("id", "approved_by", "expires_on", "justification"):
            if not item.get(key):
                fail(f"Invalid exception entry missing '{key}': {item}")
        expires = date.fromisoformat(str(item["expires_on"]))
        if expires < today:
            fail(f"Expired security exception: {item['id']} ({item['expires_on']})")


def parse_trivy_sarif(path: Path) -> int:
    if not path.exists():
        return 0
    data = json.loads(path.read_text(encoding="utf-8"))
    count = 0
    for run in data.get("runs", []):
        for result in run.get("results", []):
            level = (result.get("level") or "").lower()
            if level in {"error", "warning"}:
                count += 1
    return count


def main() -> None:
    exceptions_path = Path("security/exceptions/security-exceptions.yaml")
    validate_exceptions(exceptions_path)

    trivy_web = parse_trivy_sarif(Path("trivy-web.sarif"))
    trivy_worker = parse_trivy_sarif(Path("trivy-worker.sarif"))
    total_findings = trivy_web + trivy_worker

    # Gate: any high/critical (serialized as warning/error in SARIF) fails.
    if total_findings > 0:
        fail(f"Security gate failed: {total_findings} Trivy findings at warning/error level")

    print("Security gates passed.")


if __name__ == "__main__":
    main()
