"""Termux compatibility for OpenAI's image-only CLI process.

The OpenAI SDK imports ``jiter.from_json`` from its optional chat-streaming
surface even when only the Image API is used. Android/Termux has no wheel for
that Rust package. Image generation never calls this function, but a complete
JSON fallback keeps the import honest if a non-streaming path reaches it.
"""

from __future__ import annotations

import json
from typing import Any


def from_json(data: bytes | bytearray | str, *, partial_mode: bool = False, **_: Any) -> Any:
    if partial_mode:
        raise RuntimeError("partial JSON parsing is unavailable in the imagegen compatibility layer")
    return json.loads(data)
