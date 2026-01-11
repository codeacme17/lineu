#!/usr/bin/env python3
"""
Lineu Knowledge Capture Hook

This hook runs when an AI assistant completes a task and asks the AI
to call the capture_context MCP tool to record knowledge cards.

Supports:
- Cursor (stop hook) - returns followup_message
- Claude Code (Stop hook) - returns block decision

Usage:
- Cursor: Configure in ~/.cursor/hooks.json or project .cursor/hooks.json
- Claude Code: Configure in ~/.claude/settings.json or project .claude/settings.json
"""

import json
import sys
import os
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

# State file to track prompts and prevent duplicates
STATE_DIR = Path(os.getenv("TMPDIR", "/tmp")) / "lineu-hooks"
STATE_FILE = STATE_DIR / "capture-state.json"

# How long to remember prompted sessions (in hours)
STATE_RETENTION_HOURS = 24


def get_state_file() -> Path:
    """Ensure state directory exists and return state file path."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    return STATE_FILE


def load_state() -> dict:
    """Load state from temp file."""
    try:
        state_file = get_state_file()
        if state_file.exists():
            state = json.loads(state_file.read_text())
            # Clean up old entries
            cutoff = (datetime.now() - timedelta(hours=STATE_RETENTION_HOURS)).isoformat()
            state["triggered"] = {
                k: v for k, v in state.get("triggered", {}).items()
                if v.get("timestamp", "") > cutoff
            }
            return state
    except Exception:
        pass
    return {"triggered": {}}


def save_state(state: dict):
    """Save state to temp file."""
    try:
        state_file = get_state_file()
        state_file.write_text(json.dumps(state, indent=2))
    except Exception:
        pass


def get_session_key(input_data: dict) -> str:
    """Generate a unique key for this session/generation."""
    identifiers = [
        input_data.get("conversation_id", ""),
        input_data.get("generation_id", ""),
        input_data.get("session_id", ""),
        os.getenv("CLAUDE_PROJECT_DIR", ""),
    ]
    combined = ":".join(filter(None, identifiers))
    if combined:
        return hashlib.md5(combined.encode()).hexdigest()[:12]
    return datetime.now().strftime("%Y%m%d%H%M")


def should_trigger(session_key: str) -> bool:
    """Check if we should trigger for this session."""
    state = load_state()
    return session_key not in state.get("triggered", {})


def mark_triggered(session_key: str):
    """Mark that we've triggered for this session."""
    state = load_state()
    if "triggered" not in state:
        state["triggered"] = {}
    state["triggered"][session_key] = {
        "timestamp": datetime.now().isoformat()
    }
    save_state(state)


def detect_platform(input_data: dict) -> str:
    """Detect which platform we're running on based on input schema."""
    if "hook_event_name" in input_data:
        return "cursor"
    return "claude_code"


def get_capture_prompt() -> str:
    """Get the followup message to trigger MCP tool call."""
    return """[TASK] 请调用 capture_context MCP 工具记录本次对话的知识点。

参数说明：
- type: 根据本次对话选择
  - "bug": 如果是修复问题/调试
  - "best_practice": 如果涉及设计模式/最佳实践/架构决策
  - "knowledge": 如果是概念/API/技术知识
- seedText: 用中文简要总结本次任务的关键知识点（1-3句话）
- pushToExtension: true

示例调用：
capture_context({
  type: "knowledge",
  seedText: "防抖函数通过 setTimeout 延迟执行，每次调用时清除之前的定时器，确保只有最后一次调用生效。",
  pushToExtension: true
})

请根据我们的对话内容，立即调用此工具。"""


def is_meaningful_completion(input_data: dict, platform: str) -> bool:
    """Determine if this looks like a meaningful task completion."""
    if platform == "cursor":
        status = input_data.get("status", "")
        loop_count = input_data.get("loop_count", 0)
        # Only trigger on successful completion
        # loop_count >= 0 means this is the first stop (not a follow-up)
        return status == "completed" and loop_count == 0
    return True


def handle_cursor_stop(input_data: dict) -> Optional[dict]:
    """Handle Cursor stop hook - return followup_message to trigger MCP tool."""
    session_key = get_session_key(input_data)

    if not is_meaningful_completion(input_data, "cursor"):
        return None

    if not should_trigger(session_key):
        return None

    mark_triggered(session_key)

    # Return followup_message to ask AI to call capture_context MCP tool
    return {
        "followup_message": get_capture_prompt()
    }


def handle_claude_code_stop(input_data: dict) -> Optional[dict]:
    """Handle Claude Code Stop hook - return block decision to trigger MCP tool."""
    session_key = get_session_key(input_data)

    if not should_trigger(session_key):
        return None

    mark_triggered(session_key)

    # Return block decision with instructions to call MCP tool
    return {
        "decision": "block",
        "reason": get_capture_prompt()
    }


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    platform = detect_platform(input_data)
    result = None

    if platform == "cursor":
        result = handle_cursor_stop(input_data)
    elif platform == "claude_code":
        result = handle_claude_code_stop(input_data)

    if result:
        print(json.dumps(result))

    sys.exit(0)


if __name__ == "__main__":
    main()
