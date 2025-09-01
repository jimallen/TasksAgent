#!/bin/bash

set -e

# Get the actual user who called sudo (not root)
if [ -n "$SUDO_USER" ]; then
    USER_NAME=${1:-$SUDO_USER}
else
    USER_NAME=${1:-$USER}
fi

# Ensure we're not installing for root
if [ "$USER_NAME" = "root" ]; then
    echo "Error: Service should not be installed for root user"
    echo "Usage: sudo $0 [username]"
    echo "Or just: sudo $0  (will use your current user)"
    exit 1
fi

SERVICE_NAME="meeting-transcript-agent@${USER_NAME}"
SERVICE_FILE="/etc/systemd/system/meeting-transcript-agent@.service"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing Meeting Transcript Agent Service for user: ${USER_NAME}"
echo "Project directory: ${PROJECT_DIR}"

if [ "$EUID" -ne 0 ]; then 
    echo "This script must be run with sudo"
    exit 1
fi

echo "Building the project as user ${USER_NAME}..."
cd "${PROJECT_DIR}"
sudo -u ${USER_NAME} npm run build

echo "Creating log directory..."
mkdir -p "${PROJECT_DIR}/logs"
chown -R ${USER_NAME}:${USER_NAME} "${PROJECT_DIR}/logs"

# Get the Obsidian vault path from .env or ask user
VAULT_PATH=""
if [ -f "${PROJECT_DIR}/.env" ]; then
    VAULT_PATH=$(grep "^OBSIDIAN_VAULT_PATH=" "${PROJECT_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$VAULT_PATH" ]; then
    echo ""
    echo "Enter your Obsidian vault path (or press Enter to skip):"
    echo "Example: /home/${USER_NAME}/Documents/ObsidianVault"
    read -p "Vault path: " VAULT_PATH
fi

# Expand tilde and environment variables
if [ -n "$VAULT_PATH" ]; then
    VAULT_PATH=$(eval echo "$VAULT_PATH")
    
    if [ ! -d "$VAULT_PATH" ]; then
        echo "Warning: Vault directory does not exist: $VAULT_PATH"
        echo "The service will be installed but may need manual configuration."
    else
        echo "Using Obsidian vault: $VAULT_PATH"
    fi
fi

echo "Generating systemd service file..."

# Generate the service file dynamically
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Meeting Transcript Agent Daemon
Documentation=https://github.com/jimallen/meeting-transcript-agent
After=network.target

[Service]
Type=simple
User=%i
WorkingDirectory=/home/%i/Code/TasksAgent
ExecStart=/usr/bin/node /home/%i/Code/TasksAgent/dist/daemon.js --headless
Restart=on-failure
RestartSec=10
StandardOutput=append:/home/%i/Code/TasksAgent/logs/daemon.log
StandardError=append:/home/%i/Code/TasksAgent/logs/daemon-error.log
Environment="NODE_ENV=production"

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
# Allow writing to project directory and optionally to Obsidian vault
EOF

# Add vault to ReadWritePaths if provided
if [ -n "$VAULT_PATH" ]; then
    echo "ReadWritePaths=/home/%i/Code/TasksAgent \"${VAULT_PATH}\"" >> "${SERVICE_FILE}"
else
    echo "ReadWritePaths=/home/%i/Code/TasksAgent" >> "${SERVICE_FILE}"
    echo "# Note: No Obsidian vault path configured. Add it to ReadWritePaths if needed." >> "${SERVICE_FILE}"
fi

cat >> "${SERVICE_FILE}" <<EOF

[Install]
WantedBy=multi-user.target
EOF

echo "Service file generated successfully"

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling service..."
systemctl enable "${SERVICE_NAME}"

echo ""
echo "Service installed successfully!"
echo ""
echo "Available commands:"
echo "  Start service:   sudo systemctl start ${SERVICE_NAME}"
echo "  Stop service:    sudo systemctl stop ${SERVICE_NAME}"
echo "  Service status:  sudo systemctl status ${SERVICE_NAME}"
echo "  View logs:       sudo journalctl -u ${SERVICE_NAME} -f"
echo "  Disable service: sudo systemctl disable ${SERVICE_NAME}"
echo ""
echo "To start the service now, run:"
echo "  sudo systemctl start ${SERVICE_NAME}"