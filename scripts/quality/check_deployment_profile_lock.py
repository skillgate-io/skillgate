"""Validate deployment profile lock contract for local/staging/production."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

PROFILE_LOCK_PATH = Path("docs/open-core/deployment-profile-lock.json")


def _load_profiles() -> dict:
    return json.loads(PROFILE_LOCK_PATH.read_text(encoding="utf-8"))


def _is_https(url: str) -> bool:
    return urlparse(url).scheme == "https"


def _is_local_http(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}


def validate() -> list[str]:
    errors: list[str] = []
    payload = _load_profiles()

    profiles = payload.get("profiles")
    if not isinstance(profiles, dict):
        return ["profiles must be an object"]

    for required in ("local", "staging", "production"):
        if required not in profiles:
            errors.append(f"missing profile: {required}")

    for name, profile in profiles.items():
        web = profile.get("web_base_url")
        api = profile.get("api_base_url")
        cors = profile.get("cors_origins")
        callbacks = profile.get("oauth_callbacks")

        if not isinstance(web, str) or not isinstance(api, str):
            errors.append(f"{name}: web_base_url and api_base_url must be strings")
            continue
        if not isinstance(cors, list) or not cors:
            errors.append(f"{name}: cors_origins must be a non-empty list")
        if not isinstance(callbacks, list) or not callbacks:
            errors.append(f"{name}: oauth_callbacks must be a non-empty list")

        if name in {"staging", "production"}:
            if not _is_https(web):
                errors.append(f"{name}: web_base_url must use https")
            if not _is_https(api):
                errors.append(f"{name}: api_base_url must use https")
            if any("localhost" in str(origin) or "127.0.0.1" in str(origin) for origin in cors):
                errors.append(f"{name}: cors_origins cannot include localhost")
        if name == "local":
            if not _is_local_http(web):
                errors.append("local: web_base_url must use localhost/127.0.0.1 http")
            if not _is_local_http(api):
                errors.append("local: api_base_url must use localhost/127.0.0.1 http")

        if web not in cors:
            errors.append(f"{name}: cors_origins must include web_base_url")

        api_prefix = api.rstrip("/")
        for callback in callbacks:
            if not isinstance(callback, str):
                errors.append(f"{name}: oauth callback must be string")
                continue
            if not callback.startswith(api_prefix):
                errors.append(f"{name}: callback does not match api_base_url: {callback}")

        deploy_targets = profile.get("deploy_targets")
        if not isinstance(deploy_targets, dict):
            errors.append(f"{name}: deploy_targets must be object")
            continue
        for target_key in ("api", "worker", "web"):
            if target_key not in deploy_targets:
                errors.append(f"{name}: deploy_targets missing {target_key}")

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate deployment profile lock.")
    parser.add_argument(
        "--output",
        default="docs/section-16-open-core-split-governance/artifacts/deployment-profile-lock-validation.json",
        help="Validation report output path",
    )
    args = parser.parse_args()

    errors = validate()
    report = {
        "ok": not errors,
        "profile_lock": str(PROFILE_LOCK_PATH),
        "errors": errors,
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps(report, sort_keys=True))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
