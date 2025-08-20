#!/bin/bash
# Wrapper script to run TUI with complete isolation from subprocess output

# Set environment for silent operation
export TUI_MODE=true
export NODE_NO_WARNINGS=1
export NPM_CONFIG_LOGLEVEL=silent
export NPM_CONFIG_PROGRESS=false
export FORCE_COLOR=0
export NO_COLOR=1
export CI=true
export TERM=dumb

# Run the daemon with all output suppressed except for the TUI
exec node dist/daemon.js 2>/dev/null