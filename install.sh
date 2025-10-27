#!/bin/bash
# One-liner installer for Obsidian Meeting Tasks Plugin
# Usage: curl -fsSL https://raw.githubusercontent.com/jimallen/obsidian-meeting-tasks/master/install.sh | bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_OWNER="jimallen"
REPO_NAME="obsidian-meeting-tasks"
PLUGIN_ID="meeting-tasks"

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Obsidian Meeting Tasks Plugin Installer${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo

# Check for required commands
for cmd in curl unzip; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}❌ Error: $cmd is required but not installed.${NC}"
        exit 1
    fi
done

# Detect OS for vault search paths
OS_TYPE="$(uname -s)"
case "${OS_TYPE}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*|MINGW*|MSYS*) MACHINE=Windows;;
    *)          MACHINE="UNKNOWN"
esac

echo -e "${YELLOW}📦 Downloading latest release...${NC}"

# Get latest release info
LATEST_RELEASE=$(curl -fsSL "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest")
VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$VERSION" ]; then
    echo -e "${YELLOW}⚠️  No releases found. Using files from master branch...${NC}"
    BASE_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/master"
else
    echo -e "${GREEN}✅ Found version: ${VERSION}${NC}"
    BASE_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${VERSION}"
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

echo -e "${YELLOW}📥 Downloading plugin files...${NC}"

# Download required files
curl -fsSL "${BASE_URL}/main.js" -o "${TEMP_DIR}/main.js"
curl -fsSL "${BASE_URL}/manifest.json" -o "${TEMP_DIR}/manifest.json"
curl -fsSL "${BASE_URL}/styles.css" -o "${TEMP_DIR}/styles.css"

# Verify files downloaded
for file in main.js manifest.json styles.css; do
    if [ ! -f "${TEMP_DIR}/${file}" ]; then
        echo -e "${RED}❌ Failed to download ${file}${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Files downloaded successfully!${NC}"
echo

echo -e "${BLUE}🔍 Searching for Obsidian vaults...${NC}"
echo

# Search for vaults
VAULTS=()
DEFAULT_PATHS=(
    "$HOME/Documents"
    "$HOME/Obsidian"
    "$HOME"
    "$HOME/Desktop"
    "$HOME/OneDrive"
    "$HOME/Dropbox"
    "$HOME/Google Drive"
    "$HOME/iCloud"
)

for base_path in "${DEFAULT_PATHS[@]}"; do
    if [ -d "$base_path" ]; then
        while IFS= read -r -d '' vault; do
            vault_dir=$(dirname "$vault")
            if [[ ! " ${VAULTS[*]} " =~ " ${vault_dir} " ]]; then
                VAULTS+=("$vault_dir")
            fi
        done < <(find "$base_path" -maxdepth 4 -type d -name ".obsidian" -print0 2>/dev/null)
    fi
done

if [ ${#VAULTS[@]} -eq 0 ]; then
    echo -e "${YELLOW}No Obsidian vaults found automatically.${NC}"
    echo
    echo -e "${BLUE}Please enter the full path to your Obsidian vault:${NC}"
    read -r custom_path

    custom_path="${custom_path/#\~/$HOME}"

    if [ ! -d "$custom_path/.obsidian" ]; then
        echo -e "${RED}❌ No .obsidian folder found at: $custom_path${NC}"
        echo -e "${YELLOW}Make sure you entered the correct vault path.${NC}"
        exit 1
    fi

    VAULTS+=("$custom_path")
fi

echo -e "${GREEN}Found ${#VAULTS[@]} Obsidian vault(s):${NC}"
echo

for i in "${!VAULTS[@]}"; do
    vault_name=$(basename "${VAULTS[$i]}")
    echo -e "  ${BLUE}[$((i+1))]${NC} $vault_name"
    echo -e "      ${YELLOW}${VAULTS[$i]}${NC}"
done

echo
echo -e "${BLUE}Select a vault to install the plugin (enter number):${NC}"
if [ ${#VAULTS[@]} -gt 1 ]; then
    echo -e "${YELLOW}Or enter 'all' to install to all vaults:${NC}"
fi

read -r selection

if [ "$selection" = "all" ] && [ ${#VAULTS[@]} -gt 1 ]; then
    SELECTED_VAULTS=("${VAULTS[@]}")
elif [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#VAULTS[@]} ]; then
    SELECTED_VAULTS=("${VAULTS[$((selection-1))]}")
else
    echo -e "${RED}❌ Invalid selection!${NC}"
    exit 1
fi

for vault_path in "${SELECTED_VAULTS[@]}"; do
    echo
    vault_name=$(basename "$vault_path")
    echo -e "${BLUE}Installing to: ${vault_name}${NC}"

    PLUGIN_DIR="$vault_path/.obsidian/plugins/$PLUGIN_ID"

    mkdir -p "$PLUGIN_DIR"

    cp "${TEMP_DIR}/main.js" "$PLUGIN_DIR/"
    cp "${TEMP_DIR}/manifest.json" "$PLUGIN_DIR/"
    cp "${TEMP_DIR}/styles.css" "$PLUGIN_DIR/"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully installed to: $vault_name${NC}"
    else
        echo -e "${RED}❌ Failed to install to: $vault_name${NC}"
    fi
done

echo
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Installation complete!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Restart Obsidian or reload with Ctrl/Cmd+R"
echo -e "  2. Enable the plugin in Settings → Community Plugins"
echo -e "  3. Configure Gmail OAuth and Claude API in plugin settings"
echo
echo -e "${BLUE}Documentation:${NC}"
echo -e "  ${YELLOW}https://github.com/${REPO_OWNER}/${REPO_NAME}${NC}"
echo
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
