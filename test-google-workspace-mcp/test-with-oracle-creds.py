#!/usr/bin/env python3
"""
Test script to verify Google Workspace MCP works with celebrate-oracle credentials
"""

import json
import os
import subprocess
import sys
from pathlib import Path

def setup_oauth_from_celebrate_oracle():
    """Convert celebrate-oracle credentials to environment variables for Google Workspace MCP"""
    oracle_path = Path.home() / '.celebrate-oracle'

    # Check for client_secret.json
    client_secret_file = oracle_path / 'client_secret.json'
    if client_secret_file.exists():
        with open(client_secret_file, 'r') as f:
            data = json.load(f)
            if 'installed' in data:
                installed = data['installed']
                os.environ['GOOGLE_OAUTH_CLIENT_ID'] = installed['client_id']
                os.environ['GOOGLE_OAUTH_CLIENT_SECRET'] = installed['client_secret']
                print(f"✓ Set GOOGLE_OAUTH_CLIENT_ID: {installed['client_id'][:30]}...")
                print(f"✓ Set GOOGLE_OAUTH_CLIENT_SECRET: {installed['client_secret'][:15]}...")
                return True
    return False

def test_tool_discovery():
    """Test tool discovery with the Google Workspace MCP"""

    print("\n=== Testing Google Workspace MCP Tool Discovery ===\n")

    # Setup OAuth from celebrate-oracle
    if not setup_oauth_from_celebrate_oracle():
        print("❌ No celebrate-oracle credentials found")
        return False

    # Change to MCP directory
    mcp_dir = Path(__file__).parent / 'google_workspace_mcp'
    os.chdir(mcp_dir)

    # Ensure PATH includes uv
    os.environ['PATH'] = f"{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}"

    print("\n📦 Setting up dependencies...")
    try:
        # Initialize virtual environment and install dependencies
        subprocess.run(['uv', 'sync'], check=True, capture_output=True, text=True)
        print("✓ Dependencies installed")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        return False

    print("\n🔍 Discovering available tools...")

    # Run a simple Python script to list tools
    discovery_script = '''
import sys
import os
from pathlib import Path

# Suppress logs
import logging
logging.basicConfig(level=logging.ERROR)

# Import the Gmail module
try:
    from gmail.gmail_tools import (
        search_gmail_messages,
        get_gmail_message_content,
        send_gmail_message,
        create_gmail_draft,
        list_gmail_labels,
        get_gmail_thread,
        list_gmail_threads,
        modify_gmail_message,
        delete_gmail_message,
        trash_gmail_message,
        untrash_gmail_message
    )

    tools = [
        "search_gmail_messages",
        "get_gmail_message_content",
        "send_gmail_message",
        "create_gmail_draft",
        "list_gmail_labels",
        "get_gmail_thread",
        "list_gmail_threads",
        "modify_gmail_message",
        "delete_gmail_message",
        "trash_gmail_message",
        "untrash_gmail_message"
    ]

    print("Available Gmail tools:")
    for tool in tools:
        print(f"  - {tool}")

    # Check for our required tools
    required = ["search_gmail_messages", "get_gmail_message_content"]
    found = [t for t in required if t in tools]
    print(f"\\nRequired tools found: {len(found)}/{len(required)}")

except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)
'''

    try:
        result = subprocess.run(
            ['uv', 'run', 'python', '-c', discovery_script],
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)

        if "Required tools found: 2/2" in result.stdout:
            print("\n✅ All required tools discovered successfully!")
            return True
        else:
            print("\n⚠️ Not all required tools found")
            return False

    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to discover tools: {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        return False

def create_compatibility_doc():
    """Create a document with tool name mappings"""

    mapping = {
        "current_mcp": {
            "search": "search_emails",
            "read": "read_email"
        },
        "google_workspace_mcp": {
            "search": "search_gmail_messages",
            "read": "get_gmail_message_content"
        }
    }

    doc_path = Path(__file__).parent / 'tool-name-mapping.json'
    with open(doc_path, 'w') as f:
        json.dump(mapping, f, indent=2)

    print(f"\n📝 Created tool name mapping at: {doc_path}")

    return mapping

if __name__ == "__main__":
    # Test tool discovery
    success = test_tool_discovery()

    if success:
        # Create mapping document
        mapping = create_compatibility_doc()

        print("\n=== Tool Name Mapping ===")
        print(f"Current MCP → Google Workspace MCP:")
        print(f"  search_emails → search_gmail_messages")
        print(f"  read_email → get_gmail_message_content")

    sys.exit(0 if success else 1)