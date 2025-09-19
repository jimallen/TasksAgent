#!/usr/bin/env python3
"""
Minimal test to verify Google Workspace MCP Gmail tools availability
"""

import json
import os
import sys
from pathlib import Path

# Add MCP directory to path
mcp_dir = Path(__file__).parent / 'google_workspace_mcp'
sys.path.insert(0, str(mcp_dir))

def setup_oauth_from_existing():
    """Convert existing Gmail MCP credentials to environment variables"""
    gmail_mcp_path = Path.home() / '.gmail-mcp'
    oauth_file = gmail_mcp_path / 'gcp-oauth.keys.json'

    if oauth_file.exists():
        with open(oauth_file, 'r') as f:
            oauth_data = json.load(f)

        if 'client_id' in oauth_data:
            os.environ['GOOGLE_OAUTH_CLIENT_ID'] = oauth_data['client_id']
            print(f"✓ Set GOOGLE_OAUTH_CLIENT_ID: {oauth_data['client_id'][:20]}...")

        if 'client_secret' in oauth_data:
            os.environ['GOOGLE_OAUTH_CLIENT_SECRET'] = oauth_data['client_secret']
            print(f"✓ Set GOOGLE_OAUTH_CLIENT_SECRET: {oauth_data['client_secret'][:10]}...")

        return True
    return False

def test_gmail_tools():
    """Test Gmail tools availability"""

    print("\n=== Testing Google Workspace MCP Gmail Tools ===\n")

    # Setup OAuth
    if not setup_oauth_from_existing():
        print("❌ No existing Gmail MCP credentials found")
        return False

    # Change to MCP directory
    os.chdir(mcp_dir)

    try:
        # Import Gmail tools module
        from gmail import gmail_tools
        print("✓ Successfully imported Gmail tools module")

        # List available functions that are tools
        tools = []
        for name in dir(gmail_tools):
            obj = getattr(gmail_tools, name)
            if callable(obj) and not name.startswith('_'):
                # Check if it's decorated as a tool
                if hasattr(obj, '__name__') and 'gmail' in name.lower():
                    tools.append(name)

        print(f"\n📋 Found {len(tools)} Gmail tools:")
        for tool in sorted(tools):
            print(f"  - {tool}")

        # Check for the specific tools we need
        required_tools = ['search_gmail_messages', 'get_gmail_message_content']
        missing_tools = [tool for tool in required_tools if tool not in tools]

        if missing_tools:
            print(f"\n⚠️ Missing required tools: {', '.join(missing_tools)}")
        else:
            print(f"\n✓ All required tools found!")

        return len(missing_tools) == 0

    except ImportError as e:
        print(f"❌ Failed to import Gmail tools: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = test_gmail_tools()
    sys.exit(0 if success else 1)