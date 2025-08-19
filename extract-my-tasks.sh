#!/bin/bash

# Extract Jim Allen's tasks from Obsidian vault
# Usage: ./extract-my-tasks.sh

VAULT_PATH="/home/jima/Documents/Jim's Vault"
ASSIGNEE="Jim Allen"
OUTPUT_FILE="my-tasks-$(date +%Y-%m-%d).md"

echo "# Tasks for $ASSIGNEE - $(date +%Y-%m-%d)" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Extracted from Meeting Transcript Agent" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Count tasks
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0
TOTAL_COUNT=0

# Extract tasks grouped by priority
echo "## 🔴 High Priority Tasks" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

find "$VAULT_PATH/Meetings" -name "*.md" -type f | while read file; do
    high_tasks=$(grep "\- \[ \].*🔴.*@\[\[$ASSIGNEE\]\]" "$file" 2>/dev/null)
    if [ ! -z "$high_tasks" ]; then
        filename=$(basename "$file" .md)
        echo "### From: $filename" >> "$OUTPUT_FILE"
        echo "$high_tasks" | while IFS= read -r line; do
            echo "$line" >> "$OUTPUT_FILE"
            ((HIGH_COUNT++))
            ((TOTAL_COUNT++))
        done
        echo "" >> "$OUTPUT_FILE"
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "## 🟡 Medium Priority Tasks" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

find "$VAULT_PATH/Meetings" -name "*.md" -type f | while read file; do
    medium_tasks=$(grep "\- \[ \].*🟡.*@\[\[$ASSIGNEE\]\]" "$file" 2>/dev/null)
    if [ ! -z "$medium_tasks" ]; then
        filename=$(basename "$file" .md)
        echo "### From: $filename" >> "$OUTPUT_FILE"
        echo "$medium_tasks" | while IFS= read -r line; do
            echo "$line" >> "$OUTPUT_FILE"
            ((MEDIUM_COUNT++))
            ((TOTAL_COUNT++))
        done
        echo "" >> "$OUTPUT_FILE"
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "## 🟢 Low Priority Tasks" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

find "$VAULT_PATH/Meetings" -name "*.md" -type f | while read file; do
    low_tasks=$(grep "\- \[ \].*🟢.*@\[\[$ASSIGNEE\]\]" "$file" 2>/dev/null)
    if [ ! -z "$low_tasks" ]; then
        filename=$(basename "$file" .md)
        echo "### From: $filename" >> "$OUTPUT_FILE"
        echo "$low_tasks" | while IFS= read -r line; do
            echo "$line" >> "$OUTPUT_FILE"
            ((LOW_COUNT++))
            ((TOTAL_COUNT++))
        done
        echo "" >> "$OUTPUT_FILE"
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "## Summary" >> "$OUTPUT_FILE"
echo "- Total tasks: $(grep -r "\- \[ \].*@\[\[$ASSIGNEE\]\]" "$VAULT_PATH/Meetings" --include="*.md" 2>/dev/null | wc -l)" >> "$OUTPUT_FILE"
echo "- High priority: $(grep -r "\- \[ \].*🔴.*@\[\[$ASSIGNEE\]\]" "$VAULT_PATH/Meetings" --include="*.md" 2>/dev/null | wc -l)" >> "$OUTPUT_FILE"
echo "- Medium priority: $(grep -r "\- \[ \].*🟡.*@\[\[$ASSIGNEE\]\]" "$VAULT_PATH/Meetings" --include="*.md" 2>/dev/null | wc -l)" >> "$OUTPUT_FILE"
echo "- Low priority: $(grep -r "\- \[ \].*🟢.*@\[\[$ASSIGNEE\]\]" "$VAULT_PATH/Meetings" --include="*.md" 2>/dev/null | wc -l)" >> "$OUTPUT_FILE"

echo ""
echo "✅ Tasks extracted to: $OUTPUT_FILE"
echo ""
echo "Summary:"
echo "--------"
grep "^- " "$OUTPUT_FILE" | tail -4

# Optionally copy to Obsidian vault
read -p "Copy to Obsidian vault? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cp "$OUTPUT_FILE" "$VAULT_PATH/My Tasks - $(date +%Y-%m-%d).md"
    echo "✅ Copied to Obsidian vault: $VAULT_PATH/My Tasks - $(date +%Y-%m-%d).md"
fi