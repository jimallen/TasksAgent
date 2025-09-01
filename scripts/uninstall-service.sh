#!/bin/bash

set -e

# Get the actual user who called sudo (not root)
if [ -n "$SUDO_USER" ]; then
    USER_NAME=${1:-$SUDO_USER}
else
    USER_NAME=${1:-$USER}
fi

SERVICE_NAME="meeting-transcript-agent@${USER_NAME}"

echo "Uninstalling Meeting Transcript Agent Service for user: ${USER_NAME}"

if [ "$EUID" -ne 0 ]; then 
    echo "This script must be run with sudo"
    exit 1
fi

# Stop the service if running
echo "Stopping service..."
systemctl stop "${SERVICE_NAME}" 2>/dev/null || true

# Disable the service
echo "Disabling service..."
systemctl disable "${SERVICE_NAME}" 2>/dev/null || true

# Remove the service file
if [ -f "/etc/systemd/system/meeting-transcript-agent@.service" ]; then
    echo "Removing service file..."
    rm "/etc/systemd/system/meeting-transcript-agent@.service"
fi

# Reload systemd
echo "Reloading systemd daemon..."
systemctl daemon-reload

echo ""
echo "Service uninstalled successfully!"
echo ""
echo "Note: Project files and logs have been preserved in:"
echo "  - $(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"