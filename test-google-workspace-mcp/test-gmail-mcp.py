#!/usr/bin/env python3
"""
Test script to verify Google Workspace MCP Gmail functionality
Tests the MCP server with existing OAuth credentials
"""

import json
import os
import asyncio
import subprocess
import time
from pathlib import Path

def setup_oauth_from_existing():
    """Convert existing Gmail MCP credentials to environment variables"""
    gmail_mcp_path = Path.home() / '.gmail-mcp'

    # Check for existing OAuth files
    oauth_file = gmail_mcp_path / 'gcp-oauth.keys.json'
    if oauth_file.exists():
        with open(oauth_file, 'r') as f:
            oauth_data = json.load(f)

        # Set environment variables from OAuth data
        if 'client_id' in oauth_data:
            os.environ['GOOGLE_OAUTH_CLIENT_ID'] = oauth_data['client_id']
            print(f"✓ Set GOOGLE_OAUTH_CLIENT_ID")

        if 'client_secret' in oauth_data:
            os.environ['GOOGLE_OAUTH_CLIENT_SECRET'] = oauth_data['client_secret']
            print(f"✓ Set GOOGLE_OAUTH_CLIENT_SECRET")

        return True
    return False

def test_mcp_server():
    """Test the Google Workspace MCP server with Gmail tools"""

    print("\n=== Testing Google Workspace MCP ===\n")

    # Setup OAuth from existing credentials
    if not setup_oauth_from_existing():
        print("❌ No existing Gmail MCP credentials found")
        return False

    # Change to the MCP directory
    mcp_dir = Path(__file__).parent / 'google_workspace_mcp'
    os.chdir(mcp_dir)

    print("\n📦 Installing dependencies...")
    # Install uv if not present
    try:
        subprocess.run(['uv', '--version'], check=True, capture_output=True)
        print("✓ uv is installed")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Installing uv...")
        subprocess.run(['pip', 'install', 'uv'], check=True)

    # Install dependencies
    subprocess.run(['uv', 'sync'], check=True)
    print("✓ Dependencies installed")

    print("\n🚀 Starting MCP server...")
    # Start the MCP server in test mode
    process = subprocess.Popen(
        ['uv', 'run', 'main.py', '--tools', 'gmail', '--transport', 'stdio'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    # Give it time to start
    time.sleep(2)

    # Send initialization request
    init_request = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": True
            },
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        },
        "id": 1
    }

    print("\n📤 Sending initialization request...")
    process.stdin.write(json.dumps(init_request) + '\n')
    process.stdin.flush()

    # Read response
    response_line = process.stdout.readline()
    if response_line:
        try:
            response = json.loads(response_line)
            print(f"📥 Response: {json.dumps(response, indent=2)}")

            if 'result' in response:
                print("✓ Server initialized successfully")

                # List available tools
                list_tools_request = {
                    "jsonrpc": "2.0",
                    "method": "tools/list",
                    "params": {},
                    "id": 2
                }

                print("\n📤 Listing available tools...")
                process.stdin.write(json.dumps(list_tools_request) + '\n')
                process.stdin.flush()

                tools_response = process.stdout.readline()
                if tools_response:
                    tools = json.loads(tools_response)
                    if 'result' in tools and 'tools' in tools['result']:
                        print("\n📋 Available Gmail tools:")
                        for tool in tools['result']['tools']:
                            print(f"  - {tool.get('name', 'unknown')}")

        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse response: {e}")
            print(f"Raw response: {response_line}")

    # Clean up
    process.terminate()
    process.wait(timeout=5)

    print("\n✅ Test completed")
    return True

if __name__ == "__main__":
    test_mcp_server()