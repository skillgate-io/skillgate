#!/bin/bash
#
# SkillGate CLI Installer for macOS and Linux
#
# Usage:
#   curl -fsSL https://skillgate.io/install.sh | sh
#
# Or:
#   curl -fsSL https://skillgate.io/install.sh | sh -s -- --version 1.0.0
#
# Options:
#   --version VERSION    Install specific version (default: latest)
#   --prefix PATH        Install prefix (default: /usr/local)
#   --no-modify-path     Don't add to PATH in shell profile
#   --uninstall          Remove SkillGate
#

set -e

# Configuration
REPO_URL="https://github.com/skillgate/skillgate"
DEFAULT_PREFIX="/usr/local"
BINARY_NAME="skillgate"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
VERSION="latest"
PREFIX=""
MODIFY_PATH=true
UNINSTALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --prefix)
            PREFIX="$2"
            shift 2
            ;;
        --no-modify-path)
            MODIFY_PATH=false
            shift
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Detect OS and architecture
detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Darwin)
            PLATFORM="macos"
            ;;
        Linux)
            PLATFORM="linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            PLATFORM="windows"
            echo -e "${RED}Error: Windows detected. Please use the PowerShell installer.${NC}"
            exit 1
            ;;
        *)
            echo -e "${RED}Error: Unsupported OS: $OS${NC}"
            exit 1
            ;;
    esac

    case "$ARCH" in
        x86_64|amd64)
            ARCH="x86_64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Error: Unsupported architecture: $ARCH${NC}"
            exit 1
            ;;
    esac

    echo -e "${BLUE}Detected platform: ${PLATFORM}-${ARCH}${NC}"
}

# Get latest version from GitHub
get_latest_version() {
    curl -fsSL "https://api.github.com/repos/skillgate/skillgate/releases/latest" | \
        grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/'
}

# Download binary
download_binary() {
    local version="$1"
    local url

    if [[ "$version" == "latest" ]]; then
        version=$(get_latest_version)
    fi

    echo -e "${BLUE}Installing SkillGate v${version}...${NC}"

    # Construct download URL
    if [[ "$PLATFORM" == "macos" && "$ARCH" == "arm64" ]]; then
        # Use x86_64 binary on arm64 (Rosetta 2) until we have native arm64
        BINARY_URL="${REPO_URL}/releases/download/v${version}/skillgate-${PLATFORM}-x86_64"
    else
        BINARY_URL="${REPO_URL}/releases/download/v${version}/skillgate-${PLATFORM}-${ARCH}"
    fi

    echo -e "${BLUE}Downloading from: ${BINARY_URL}${NC}"

    # Download to temp file
    TEMP_FILE=$(mktemp)
    curl -fsSL --progress-bar -o "$TEMP_FILE" "$BINARY_URL"

    echo "$TEMP_FILE"
}

# Install binary
install_binary() {
    local binary_file="$1"
    local install_dir="${PREFIX}/bin"

    # Create install directory if needed
    sudo mkdir -p "$install_dir"

    # Install binary
    sudo install -m 755 "$binary_file" "${install_dir}/${BINARY_NAME}"

    echo -e "${GREEN}✓ Installed to ${install_dir}/${BINARY_NAME}${NC}"
}

# Add to PATH in shell profile
add_to_path() {
    local install_dir="${PREFIX}/bin"
    local profile_file=""

    # Detect shell profile
    if [[ -n "$ZSH_VERSION" ]]; then
        profile_file="$HOME/.zshrc"
    elif [[ -n "$BASH_VERSION" ]]; then
        if [[ -f "$HOME/.bashrc" ]]; then
            profile_file="$HOME/.bashrc"
        elif [[ -f "$HOME/.bash_profile" ]]; then
            profile_file="$HOME/.bash_profile"
        fi
    fi

    if [[ -z "$profile_file" ]]; then
        echo -e "${YELLOW}Could not detect shell profile. Add ${install_dir} to your PATH manually.${NC}"
        return
    fi

    # Check if already in PATH
    if grep -q "skillgate" "$profile_file" 2>/dev/null; then
        return
    fi

    # Add to PATH
    echo "" >> "$profile_file"
    echo "# Added by SkillGate installer" >> "$profile_file"
    echo "export PATH=\"${install_dir}:\$PATH\"" >> "$profile_file"

    echo -e "${GREEN}✓ Added to PATH in ${profile_file}${NC}"
    echo -e "${YELLOW}Run 'source ${profile_file}' or restart your terminal.${NC}"
}

# Uninstall
uninstall() {
    echo -e "${BLUE}Uninstalling SkillGate...${NC}"

    # Find and remove binary
    for prefix in /usr/local /opt/homebrew ~/.local; do
        if [[ -f "${prefix}/bin/${BINARY_NAME}" ]]; then
            sudo rm -f "${prefix}/bin/${BINARY_NAME}"
            echo -e "${GREEN}✓ Removed ${prefix}/bin/${BINARY_NAME}${NC}"
        fi
    done

    # Remove from PATH in profiles
    for profile in ~/.zshrc ~/.bashrc ~/.bash_profile; do
        if [[ -f "$profile" ]] && grep -q "skillgate" "$profile" 2>/dev/null; then
            # Remove lines containing skillgate
            sed -i.bak '/skillgate/d' "$profile"
            rm -f "${profile}.bak"
            echo -e "${GREEN}✓ Removed from ${profile}${NC}"
        fi
    done

    # Remove credentials
    if [[ -d "$HOME/.skillgate" ]]; then
        rm -rf "$HOME/.skillgate"
        echo -e "${GREEN}✓ Removed ~/.skillgate${NC}"
    fi

    echo -e "${GREEN}✓ Uninstalled SkillGate${NC}"
    exit 0
}

# Main
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           SkillGate CLI Installer                          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if $UNINSTALL; then
        uninstall
    fi

    # Set default prefix based on platform
    if [[ -z "$PREFIX" ]]; then
        if [[ "$PLATFORM" == "macos" ]] && [[ -d "/opt/homebrew" ]]; then
            PREFIX="/opt/homebrew"
        else
            PREFIX="$DEFAULT_PREFIX"
        fi
    fi

    detect_platform

    # Check if already installed
    if command -v skillgate &> /dev/null; then
        CURRENT_VERSION=$(skillgate version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        echo -e "${YELLOW}SkillGate v${CURRENT_VERSION} is already installed.${NC}"
        read -p "Reinstall? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi

    # Download and install
    TEMP_FILE=$(download_binary "$VERSION")

    if [[ ! -s "$TEMP_FILE" ]]; then
        echo -e "${RED}Error: Download failed${NC}"
        rm -f "$TEMP_FILE"
        exit 1
    fi

    install_binary "$TEMP_FILE"
    rm -f "$TEMP_FILE"

    # Add to PATH
    if $MODIFY_PATH; then
        add_to_path
    fi

    # Verify installation
    echo ""
    if command -v skillgate &> /dev/null; then
        INSTALLED_VERSION=$(skillgate version 2>/dev/null || echo "installed")
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ SkillGate ${INSTALLED_VERSION} installed successfully!        ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${GREEN}✓ Installation complete!${NC}"
        echo -e "${YELLOW}Run 'hash -r' or restart your terminal, then try 'skillgate --help'${NC}"
    fi

    echo ""
    echo "Next steps:"
    echo "  1. Run 'skillgate auth login' to authenticate"
    echo "  2. Run 'skillgate scan ./your-skill' to scan a skill"
    echo "  3. Run 'skillgate --help' for more commands"
    echo ""
}

main
