#!/bin/bash

set -e

# Get the actual user who called sudo (not root)
if [ -n "$SUDO_USER" ]; then
    USER_NAME=${1:-$SUDO_USER}
else
    USER_NAME=${1:-$USER}
fi

SERVICE_NAME="meeting-transcript-agent@${USER_NAME}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Updating Meeting Transcript Agent for user: ${USER_NAME}"
echo "Project directory: ${PROJECT_DIR}"

# Check if running with sudo when needed for systemctl
if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
    if [ "$EUID" -ne 0 ]; then 
        echo "Service is running. This script must be run with sudo to restart it."
        exit 1
    fi
fi

cd "${PROJECT_DIR}"

# Pull latest code if it's a git repository
if [ -d ".git" ]; then
    echo "Pulling latest code from git..."
    sudo -u ${USER_NAME} git pull || echo "Note: Could not pull from git (may have local changes)"
fi

# Install/update dependencies
echo "Updating npm dependencies..."
sudo -u ${USER_NAME} npm install

# Build the project
echo "Building the project..."
if ! sudo -u ${USER_NAME} npm run build; then
    echo "Error: Failed to build the project"
    echo "Please fix any TypeScript errors and run the script again"
    exit 1
fi

echo "Build completed successfully!"

# Check if service is installed and running
if systemctl list-unit-files | grep -q "${SERVICE_NAME}"; then
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        echo "Restarting service to apply changes..."
        systemctl restart "${SERVICE_NAME}"
        echo "Service restarted successfully!"
        
        # Show service status
        echo ""
        echo "Service status:"
        systemctl status "${SERVICE_NAME}" --no-pager | head -15
    else
        echo "Service is installed but not running."
        echo "To start it, run: sudo systemctl start ${SERVICE_NAME}"
    fi
else
    echo "Service is not installed. Run 'sudo npm run daemon:install' to install it."
fi

# Check for non-systemd daemon processes
DAEMON_PID=$(pgrep -f "node.*daemon.js" || true)
if [ -n "$DAEMON_PID" ]; then
    echo ""
    echo "Note: Found daemon process running outside systemd (PID: $DAEMON_PID)"
    echo "You may want to stop it and use the systemd service instead."
    echo "To stop it: kill $DAEMON_PID"
fi

echo ""
echo "Update complete!"
echo ""
echo "If you're running the daemon manually (not as a service), you need to restart it:"
echo "  1. Stop the current daemon (Ctrl+C or kill the process)"
echo "  2. Start it again: npm run daemon or npm run daemon:headless"