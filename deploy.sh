#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Obsidian Meeting Tasks Plugin Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo

echo -e "${YELLOW}📦 Building plugin for production...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed! Please fix errors before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"
echo

echo -e "${BLUE}🔍 Searching for Obsidian vaults...${NC}"
echo

VAULTS=()
VAULT_INDEX=1

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

PLUGIN_NAME="meeting-tasks"

for vault_path in "${SELECTED_VAULTS[@]}"; do
    echo
    vault_name=$(basename "$vault_path")
    echo -e "${BLUE}Installing to: ${vault_name}${NC}"

    PLUGIN_DIR="$vault_path/.obsidian/plugins/$PLUGIN_NAME"

    mkdir -p "$PLUGIN_DIR"

    # Copy ONLY runtime files to Obsidian plugin directory
    # Explicitly excludes development files:
    #   - bmad/ (BMAD framework for AI-assisted development)
    #   - .claude/ (Claude Code agent configurations)
    #   - .agent.rules.md (Development workflow rules)
    #   - src/ (TypeScript source code)
    #   - data*.json (User-specific configuration with credentials)
    #   - node_modules/ (Build dependencies)
    # This ensures the deployed plugin is clean and contains no sensitive data

    if [ ! -f "main.js" ] || [ ! -f "manifest.json" ] || [ ! -f "styles.css" ]; then
        echo -e "${RED}❌ Required files missing! Run 'npm run build' first.${NC}"
        exit 1
    fi

    cp main.js "$PLUGIN_DIR/"
    cp manifest.json "$PLUGIN_DIR/"
    cp styles.css "$PLUGIN_DIR/"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully installed to: $vault_name${NC}"
    else
        echo -e "${RED}❌ Failed to install to: $vault_name${NC}"
    fi
done

echo
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Deployment complete!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Restart Obsidian or reload with Ctrl/Cmd+R"
echo -e "  2. Enable the plugin in Settings → Community Plugins"
echo -e "  3. Configure Gmail OAuth and Claude API in plugin settings"
echo
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"