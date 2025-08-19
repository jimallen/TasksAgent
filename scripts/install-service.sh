#!/bin/bash

set -e

USER_NAME=${1:-$USER}
SERVICE_NAME="meeting-transcript-agent@${USER_NAME}"
SERVICE_FILE="/etc/systemd/system/meeting-transcript-agent@.service"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing Meeting Transcript Agent Service for user: ${USER_NAME}"
echo "Project directory: ${PROJECT_DIR}"

if [ "$EUID" -ne 0 ]; then 
    echo "This script must be run with sudo"
    exit 1
fi

echo "Building the project..."
cd "${PROJECT_DIR}"
npm run build

echo "Creating log directory..."
mkdir -p "${PROJECT_DIR}/logs"
chown -R ${USER_NAME}:${USER_NAME} "${PROJECT_DIR}/logs"

echo "Installing systemd service..."
cp "${PROJECT_DIR}/scripts/meeting-transcript-agent.service" "${SERVICE_FILE}"

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