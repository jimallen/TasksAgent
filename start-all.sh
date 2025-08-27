#!/bin/bash

# Start All Services for TasksAgent
# This script starts both the Gmail MCP HTTP server and the daemon service

echo "🚀 Starting TasksAgent Services..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Gmail MCP is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Gmail MCP server already running on port 3000${NC}"
else
    echo -e "${GREEN}Starting Gmail MCP HTTP server on port 3000...${NC}"
    node scripts/gmail-mcp-http.js &
    GMAIL_PID=$!
    echo "Gmail MCP PID: $GMAIL_PID"
    
    # Wait for Gmail MCP to be ready
    echo "Waiting for Gmail MCP to be ready..."
    for i in {1..10}; do
        if curl -s http://localhost:3000/health >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Gmail MCP server is ready${NC}"
            break
        fi
        sleep 1
    done
fi

echo ""

# Check if daemon is already running
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Daemon already running on port 3002${NC}"
else
    echo -e "${GREEN}Starting daemon service in headless manual-only mode...${NC}"
    npm run build >/dev/null 2>&1 && node dist/daemon.js --headless --manual-only &
    DAEMON_PID=$!
    echo "Daemon PID: $DAEMON_PID"
    
    # Wait for daemon to be ready
    echo "Waiting for daemon to be ready..."
    for i in {1..10}; do
        if curl -s http://localhost:3002/health >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Daemon service is ready${NC}"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "📊 Service Status:"
echo "==================="

# Check Gmail MCP status
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo -e "Gmail MCP (port 3000): ${GREEN}✅ Running${NC}"
else
    echo -e "Gmail MCP (port 3000): ${RED}❌ Not responding${NC}"
fi

# Check Daemon status
if curl -s http://localhost:3002/health >/dev/null 2>&1; then
    STATS=$(curl -s http://localhost:3002/stats 2>/dev/null)
    if [ ! -z "$STATS" ]; then
        echo -e "Daemon (port 3002):    ${GREEN}✅ Running${NC}"
        echo ""
        echo "Daemon Statistics:"
        echo "$STATS" | jq '.' 2>/dev/null || echo "$STATS"
    else
        echo -e "Daemon (port 3002):    ${GREEN}✅ Running${NC}"
    fi
else
    echo -e "Daemon (port 3002):    ${RED}❌ Not responding${NC}"
fi

echo ""
echo "==================="
echo ""
echo "🎯 Quick Actions:"
echo "  • Test connection:     curl http://localhost:3002/health"
echo "  • Trigger processing:  curl -X POST http://localhost:3002/trigger"
echo "  • View stats:          curl http://localhost:3002/stats"
echo "  • Open Obsidian plugin to process emails"
echo ""
echo "To stop services:"
echo "  • Kill Gmail MCP:      kill ${GMAIL_PID:-\$(lsof -ti:3000)}"
echo "  • Kill Daemon:         kill ${DAEMON_PID:-\$(lsof -ti:3002)}"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap 'echo ""; echo "Stopping services..."; kill $GMAIL_PID $DAEMON_PID 2>/dev/null; exit' INT
wait