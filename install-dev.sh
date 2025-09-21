#!/bin/bash

# Development Installation Script for Obsidian Meeting Tasks Plugin
# This script helps set up the plugin for local development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Obsidian Meeting Tasks Plugin - Development Setup${NC}"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Build the plugin
echo -e "${YELLOW}🔨 Building plugin...${NC}"
npm run build:dev

# Ask for vault path
echo ""
echo -e "${YELLOW}Please enter your Obsidian vault path:${NC}"
echo "Examples:"
echo "  - ~/Documents/ObsidianVault"
echo "  - /Users/username/ObsidianVault"
echo "  - C:\\Users\\username\\Documents\\ObsidianVault (Windows)"
echo ""
read -p "Vault path: " VAULT_PATH

# Expand tilde if present
VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

# Check if vault exists
if [ ! -d "$VAULT_PATH" ]; then
    echo -e "${RED}❌ Vault directory does not exist: $VAULT_PATH${NC}"
    exit 1
fi

# Create plugin directory
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/meeting-tasks"
mkdir -p "$PLUGIN_DIR"

# Ask for installation method
echo ""
echo -e "${YELLOW}Choose installation method:${NC}"
echo "1) Symbolic link (recommended for development)"
echo "2) Copy files (for testing)"
read -p "Choice (1 or 2): " INSTALL_METHOD

if [ "$INSTALL_METHOD" = "1" ]; then
    # Create symbolic link
    echo -e "${YELLOW}Creating symbolic link...${NC}"
    
    # Remove existing link/directory
    if [ -e "$PLUGIN_DIR" ]; then
        rm -rf "$PLUGIN_DIR"
    fi
    
    # Create symlink
    ln -s "$(pwd)" "$PLUGIN_DIR"
    echo -e "${GREEN}✓ Symbolic link created${NC}"
    
    # Start watch mode
    echo ""
    echo -e "${YELLOW}Starting watch mode for development...${NC}"
    echo -e "${GREEN}The plugin will auto-rebuild when you make changes.${NC}"
    echo -e "${GREEN}Press Ctrl+C to stop.${NC}"
    echo ""
    npm run dev
    
elif [ "$INSTALL_METHOD" = "2" ]; then
    # Copy files
    echo -e "${YELLOW}Copying plugin files...${NC}"
    
    # Copy required files
    cp main.js "$PLUGIN_DIR/"
    cp manifest.json "$PLUGIN_DIR/"
    cp styles.css "$PLUGIN_DIR/" 2>/dev/null || true
    
    echo -e "${GREEN}✓ Files copied to vault${NC}"
    echo ""
    echo -e "${GREEN}🎉 Installation complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Open Obsidian"
    echo "2. Go to Settings → Community Plugins"
    echo "3. Turn off Safe Mode"
    echo "4. Enable 'Meeting Tasks' plugin"
    echo "5. Configure the plugin settings"
    echo ""
    echo "To rebuild after changes, run: npm run build:dev"
    
else
    echo -e "${RED}Invalid choice. Please run the script again.${NC}"
    exit 1
fi