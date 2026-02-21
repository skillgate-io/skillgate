<#
.SYNOPSIS
    SkillGate CLI Installer for Windows (including WSL)

.DESCRIPTION
    Downloads and installs SkillGate CLI for Windows.

.PARAMETER Version
    Specific version to install (default: latest)

.PARAMETER InstallDir
    Installation directory (default: $env:LOCALAPPDATA\SkillGate)

.PARAMETER AddToPath
    Add to system PATH (default: true)

.PARAMETER Uninstall
    Remove SkillGate

.EXAMPLE
    irm https://skillgate.io/install.ps1 | iex

.EXAMPLE
    irm https://skillgate.io/install.ps1 | iex -Version "1.0.0"

.EXAMPLE
    irm https://skillgate.io/install.ps1 | iex -Uninstall
#>

param(
    [string]$Version = "latest",
    [string]$InstallDir = "",
    [bool]$AddToPath = $true,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$REPO_URL = "https://github.com/skillgate/skillgate"
$BINARY_NAME = "skillgate.exe"

function Write-Info($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Write-Success($msg) {
    Write-Host "[OK] $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Write-Err($msg) {
    Write-Host "[ERROR] $msg" -ForegroundColor Red
}

function Test-WSL {
    return $null -ne (Get-Command wsl -ErrorAction SilentlyContinue)
}

function Get-LatestVersion {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/skillgate/skillgate/releases/latest"
    return $release.tag_name -replace "^v", ""
}

function Uninstall-SkillGate {
    Write-Info "Uninstalling SkillGate..."

    # Find and remove binary
    $paths = @(
        "$env:LOCALAPPDATA\SkillGate",
        "$env:ProgramFiles\SkillGate",
        "$env:USERPROFILE\.skillgate"
    )

    foreach ($path in $paths) {
        if (Test-Path "$path\$BINARY_NAME") {
            Remove-Item "$path\$BINARY_NAME" -Force
            Write-Success "Removed $path\$BINARY_NAME"
        }
        if ((Test-Path $path) -and ((Get-ChildItem $path).Count -eq 0)) {
            Remove-Item $path -Force
        }
    }

    # Remove from PATH
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -match "SkillGate") {
        $newPath = ($userPath -split ";" | Where-Object { $_ -notmatch "SkillGate" }) -join ";"
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        Write-Success "Removed from PATH"
    }

    Write-Success "Uninstalled SkillGate"
    exit 0
}

function Install-SkillGate {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║           SkillGate CLI Installer (Windows)                ║" -ForegroundColor Blue
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
    Write-Host ""

    # Check for WSL and offer to install there instead
    if (Test-WSL) {
        Write-Info "WSL detected. SkillGate works great in WSL too!"
        $installWSL = Read-Host "Install in WSL instead? (y/N)"
        if ($installWSL -eq "y" -or $installWSL -eq "Y") {
            Write-Info "Running WSL installer..."
            wsl -e bash -c "curl -fsSL https://skillgate.io/install.sh | sh"
            exit 0
        }
    }

    # Detect architecture
    $arch = "x86_64"
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
        $arch = "arm64"
    }
    Write-Info "Detected architecture: windows-$arch"

    # Set install directory
    if (-not $InstallDir) {
        $InstallDir = "$env:LOCALAPPDATA\SkillGate"
    }

    # Get version
    if ($Version -eq "latest") {
        $Version = Get-LatestVersion
    }
    Write-Info "Installing SkillGate v$Version"

    # Check if already installed
    $binaryPath = "$InstallDir\$BINARY_NAME"
    if (Test-Path $binaryPath) {
        Write-Warn "SkillGate is already installed at $binaryPath"
        $reinstall = Read-Host "Reinstall? (y/N)"
        if ($reinstall -ne "y" -and $reinstall -ne "Y") {
            exit 0
        }
    }

    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    # Download binary
    $downloadUrl = "$REPO_URL/releases/download/v$Version/skillgate-windows-$arch.exe"
    Write-Info "Downloading from: $downloadUrl"

    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $binaryPath -UseBasicParsing
    } catch {
        Write-Err "Download failed: $_"
        exit 1
    }

    Write-Success "Installed to $binaryPath"

    # Add to PATH
    if ($AddToPath) {
        $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
        if ($userPath -notlike "*$InstallDir*") {
            $newPath = "$InstallDir;$userPath"
            [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
            Write-Success "Added to PATH"
        }
    }

    # Verify installation
    Write-Host ""
    if (Get-Command skillgate -ErrorAction SilentlyContinue) {
        $installedVersion = & skillgate version 2>$null
        Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
        Write-Host "║  ✓ SkillGate $installedVersion installed successfully!        ║" -ForegroundColor Green
        Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    } else {
        Write-Success "Installation complete!"
        Write-Warn "Restart your terminal or run 'refreshenv' to update PATH"
    }

    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Run 'skillgate auth login' to authenticate"
    Write-Host "  2. Run 'skillgate scan .\your-skill' to scan a skill"
    Write-Host "  3. Run 'skillgate --help' for more commands"
    Write-Host ""
}

# Main
if ($Uninstall) {
    Uninstall-SkillGate
} else {
    Install-SkillGate
}
