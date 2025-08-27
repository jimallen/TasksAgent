#!/bin/bash

# Stop All Services for TasksAgent

echo "🛑 Stopping TasksAgent Services..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stop Gmail MCP
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    PID=$(lsof -ti:3000)
    echo -e "${YELLOW}Stopping Gmail MCP server (PID: $PID)...${NC}"
    kill $PID 2>/dev/null
    sleep 1
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}Force killing Gmail MCP...${NC}"
        kill -9 $PID 2>/dev/null
    fi
    echo -e "${GREEN}✅ Gmail MCP stopped${NC}"
else
    echo -e "${YELLOW}Gmail MCP server not running${NC}"
fi

# Stop Daemon
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
    PID=$(lsof -ti:3002)
    echo -e "${YELLOW}Stopping daemon service (PID: $PID)...${NC}"
    kill $PID 2>/dev/null
    sleep 1
    if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}Force killing daemon...${NC}"
        kill -9 $PID 2>/dev/null
    fi
    echo -e "${GREEN}✅ Daemon stopped${NC}"
else
    echo -e "${YELLOW}Daemon service not running${NC}"
fi

echo ""
echo "All services stopped."