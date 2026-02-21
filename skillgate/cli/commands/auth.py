"""Authentication commands for SkillGate CLI."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import httpx
import typer
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm, Prompt

from skillgate.config.license import Tier, validate_api_key

console = Console()

# Credentials storage
CREDENTIALS_DIR = Path.home() / ".skillgate"
CREDENTIALS_FILE = CREDENTIALS_DIR / "credentials.json"

# API endpoints (configurable for dev/prod)
DEFAULT_API_BASE = "https://api.skillgate.io"


def _get_api_base() -> str:
    """Get API base URL from env or default."""
    return os.environ.get("SKILLGATE_API_URL", DEFAULT_API_BASE)


def _ensure_credentials_dir() -> None:
    """Ensure credentials directory exists with correct permissions."""
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    # Set restrictive permissions on directory
    CREDENTIALS_DIR.chmod(0o700)


def _load_credentials() -> dict[str, Any] | None:
    """Load stored credentials."""
    if not CREDENTIALS_FILE.exists():
        return None
    try:
        return json.loads(CREDENTIALS_FILE.read_text())  # type: ignore[no-any-return]
    except (json.JSONDecodeError, OSError):
        return None


def _save_credentials(creds: dict[str, Any]) -> None:
    """Save credentials to disk with restrictive permissions."""
    _ensure_credentials_dir()
    CREDENTIALS_FILE.write_text(json.dumps(creds, indent=2))
    CREDENTIALS_FILE.chmod(0o600)


def _clear_credentials() -> bool:
    """Clear stored credentials."""
    if CREDENTIALS_FILE.exists():
        CREDENTIALS_FILE.unlink()
        return True
    return False


def get_api_key() -> str | None:
    """Get API key from env var OR stored credentials.

    Priority:
    1. SKILLGATE_API_KEY environment variable (CI/CD)
    2. Stored credentials file (interactive login)
    """
    # Priority 1: Environment variable (CI/CD mode)
    if api_key := os.environ.get("SKILLGATE_API_KEY"):
        return api_key

    # Priority 2: Stored credentials
    creds = _load_credentials()
    if creds and creds.get("api_key"):
        return str(creds["api_key"])

    # Priority 3: Stored OAuth access token
    if creds and creds.get("access_token"):
        return str(creds["access_token"])

    return None


def get_current_tier() -> Tier:
    """Get current tier based on credentials."""
    api_key = get_api_key()
    if not api_key:
        return Tier.FREE
    try:
        return validate_api_key(api_key)
    except Exception:
        return Tier.FREE


def is_authenticated() -> bool:
    """Check if user is authenticated (API key exists)."""
    return get_api_key() is not None


def _verify_api_key_with_server(api_key: str) -> dict[str, Any] | None:
    """Verify API key with server and return user info."""
    try:
        resp = httpx.get(
            f"{_get_api_base()}/v1/auth/verify",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10.0,
        )
        if resp.status_code == 200:
            return resp.json()  # type: ignore[no-any-return]
    except Exception:
        pass
    return None


def _start_device_flow() -> dict[str, Any]:
    """Start OAuth device flow and return device code info."""
    resp = httpx.post(
        f"{_get_api_base()}/auth/device/code",
        json={"client_id": "skillgate-cli"},
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()  # type: ignore[no-any-return]


def _poll_device_token(device_code: str, interval: int = 5) -> dict[str, Any] | None:
    """Poll for device token completion."""
    max_attempts = 60  # 5 minutes max
    for _ in range(max_attempts):
        try:
            resp = httpx.post(
                f"{_get_api_base()}/auth/device/token",
                json={"device_code": device_code},
                timeout=10.0,
            )
            if resp.status_code == 200:
                return resp.json()  # type: ignore[no-any-return]
            if resp.status_code == 400:
                data: dict[str, Any] = resp.json()
                if data.get("error") == "authorization_pending":
                    time.sleep(interval)
                    continue
                if data.get("error") == "expired_token":
                    return None
        except Exception:
            time.sleep(interval)
    return None


# Create auth subcommand app
auth_app = typer.Typer(help="Authentication commands")


@auth_app.callback(invoke_without_command=True)
def auth_callback(ctx: typer.Context) -> None:
    """Manage authentication for SkillGate CLI."""
    if ctx.invoked_subcommand is None:
        # Default to login if no subcommand
        login_command()


@auth_app.command("login")
def login_command() -> None:
    """Log in to SkillGate (OAuth or API key).

    If SKILLGATE_API_KEY is set, shows current auth status.
    Otherwise, prompts for authentication method.
    """
    # Check if already authenticated via env var
    if env_key := os.environ.get("SKILLGATE_API_KEY"):
        console.print("[dim]SKILLGATE_API_KEY environment variable is set.[/]")
        try:
            tier = validate_api_key(env_key)
            console.print(f"[green]✓[/] Authenticated via environment variable ({tier.value} tier)")
        except Exception as e:
            console.print(f"[red]✗[/] Invalid SKILLGATE_API_KEY: {e}")
        return

    # Check if already authenticated via stored credentials
    if (creds := _load_credentials()) and creds.get("api_key"):
        try:
            tier = validate_api_key(str(creds["api_key"]))
            email = creds.get("email", "unknown")
            console.print(f"[green]✓[/] Already logged in as {email} ({tier.value} tier)")
            console.print("[dim]Run 'skillgate auth logout' to log out.[/]")
            return
        except Exception:
            pass  # Invalid stored key, continue to login

    console.print(
        Panel.fit(
            "[bold]SkillGate Authentication[/]\n\nChoose how to authenticate:",
            border_style="blue",
        )
    )

    # Ask for authentication method
    console.print("\n? Authentication method:")
    console.print("  [1] Login with GitHub (OAuth)")
    console.print("  [2] Login with Google (OAuth)")
    console.print("  [3] Paste API key")

    choice = Prompt.ask("\nSelect", choices=["1", "2", "3"], default="1")

    if choice == "3":
        _login_with_api_key()
    else:
        provider = "github" if choice == "1" else "google"
        _login_with_oauth(provider)


def _login_with_api_key() -> None:
    """Login by pasting API key directly."""
    console.print("\n[dim]Get your API key from: https://skillgate.io/dashboard/api-keys[/]\n")
    api_key = Prompt.ask("Paste your API key", password=True)

    if not api_key:
        console.print("[red]✗ No API key provided[/]")
        raise typer.Exit(1)

    # Validate format
    try:
        tier = validate_api_key(api_key)
    except Exception:
        console.print("[red]✗ Invalid API key[/]")
        raise typer.Exit(1) from None

    # Verify with server (optional, graceful fallback)
    user_info = _verify_api_key_with_server(api_key)
    email = user_info.get("email", "unknown") if user_info else f"{tier.value} user"

    # Save credentials
    _save_credentials(
        {
            "api_key": api_key,
            "tier": tier.value,
            "email": email,
            "auth_method": "api_key",
        }
    )

    console.print(f"\n[green]✓[/] Logged in as {email} ({tier.value} tier)")
    console.print("[dim]Credentials stored in ~/.skillgate/credentials.json[/]")


def _login_with_oauth(provider: str) -> None:
    """Login using OAuth device flow."""
    console.print(f"\n[dim]Starting {provider.title()} OAuth flow...[/]")

    try:
        # Start device flow
        device_info = _start_device_flow()
        device_code = device_info["device_code"]
        user_code = device_info["user_code"]
        verify_url = device_info["verification_uri"]
        interval = device_info.get("interval", 5)

        console.print(f"\n[bold]Visit:[/] {verify_url}")
        console.print(f"[bold]Enter code:[/] [cyan]{user_code}[/]\n")
        console.print("[dim]Waiting for authentication...[/]")

        # Poll for completion
        token_info = _poll_device_token(device_code, interval)

        if not token_info:
            console.print("[red]✗ Authentication timed out[/]")
            raise typer.Exit(1)

        # Save credentials
        creds = {
            "access_token": token_info["access_token"],
            "refresh_token": token_info.get("refresh_token"),
            "tier": token_info.get("tier", "pro"),
            "email": token_info.get("email", "unknown"),
            "auth_method": f"oauth_{provider}",
        }
        _save_credentials(creds)

        console.print(f"\n[green]✓[/] Logged in as {creds['email']} ({creds['tier']} tier)")

    except httpx.HTTPError as e:
        console.print(f"[red]✗ OAuth flow failed: {e}[/]")
        console.print("[dim]Try using 'skillgate auth login' with option 3 (API key)[/]")
        raise typer.Exit(1) from None


@auth_app.command("logout")
def logout_command() -> None:
    """Log out and clear stored credentials."""
    # Check if using env var
    if os.environ.get("SKILLGATE_API_KEY"):
        console.print("[yellow]SKILLGATE_API_KEY is set via environment variable.[/]")
        console.print("[dim]Unset the variable to log out: unset SKILLGATE_API_KEY[/]")
        return

    if not CREDENTIALS_FILE.exists():
        console.print("[yellow]Not logged in.[/]")
        return

    if Confirm.ask("Log out and clear stored credentials?"):
        _clear_credentials()
        console.print("[green]✓[/] Logged out successfully")


@auth_app.command("whoami")
def whoami_command() -> None:
    """Show current authenticated user."""
    # Check env var first
    if env_key := os.environ.get("SKILLGATE_API_KEY"):
        console.print("[dim]Auth via: SKILLGATE_API_KEY environment variable[/]")
        try:
            tier = validate_api_key(env_key)
            console.print(f"[green]Tier:[/] {tier.value}")
        except Exception:
            console.print("[red]Invalid API key[/]")
        return

    # Check stored credentials
    creds = _load_credentials()
    if not creds:
        console.print("[yellow]Not logged in.[/]")
        console.print("[dim]Run 'skillgate auth login' to authenticate.[/]")
        raise typer.Exit(1)

    email = creds.get("email", "unknown")
    tier = creds.get("tier", "unknown")
    auth_method = creds.get("auth_method", "unknown")

    console.print(
        Panel.fit(
            f"[bold]Authenticated User[/]\n\n"
            f"[green]Email:[/] {email}\n"
            f"[green]Tier:[/] {tier}\n"
            f"[green]Auth method:[/] {auth_method}",
            border_style="green",
        )
    )


@auth_app.command("status")
def status_command() -> None:
    """Show authentication status (alias for whoami)."""
    whoami_command()
