#!/usr/bin/env python3
"""Retry transient transport failures for the project image generation wrapper."""

from __future__ import annotations

import os
import math
from pathlib import Path
import subprocess
import sys
import time
from typing import Callable, Sequence


RETRYABLE_COMMANDS = {"generate", "edit"}
TRANSIENT_MARKERS = (
    "remoteprotocolerror",
    "server disconnected",
    "connection reset",
    "connection aborted",
    "connection refused",
    "temporary failure",
    "temporarily unavailable",
    "timed out",
    "timeout",
    "status code 502",
    "status code 503",
    "status code 504",
    "error code: 502",
    "error code: 503",
    "error code: 504",
    "rate limit",
    "too many requests",
)


def is_retryable_transport_error(output: str) -> bool:
    normalized = output.lower()
    return any(marker in normalized for marker in TRANSIENT_MARKERS)


def retry_count_for(command: Sequence[str], configured_attempts: int) -> int:
    if not command or command[0] not in RETRYABLE_COMMANDS or "--dry-run" in command:
        return 1
    return configured_attempts


def relay_output(result: subprocess.CompletedProcess[str]) -> None:
    if result.stdout:
        print(result.stdout, end="", file=sys.stdout)
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)


def run_with_retries(
    image_generator: str,
    command: Sequence[str],
    *,
    max_attempts: int,
    retry_base_seconds: float,
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
    sleeper: Callable[[float], None] = time.sleep,
) -> int:
    attempts = retry_count_for(command, max_attempts)
    for attempt in range(1, attempts + 1):
        result = runner(
            [sys.executable, image_generator, *command],
            check=False,
            capture_output=True,
            text=True,
            env=os.environ.copy(),
        )
        relay_output(result)
        if result.returncode == 0:
            return 0

        output = f"{result.stdout}\n{result.stderr}"
        if attempt == attempts or not is_retryable_transport_error(output):
            return result.returncode

        delay = min(30.0, retry_base_seconds * (2 ** (attempt - 1)))
        print(
            f"Image generation transport failure (attempt {attempt}/{attempts}); "
            f"retrying in {delay:.1f}s.",
            file=sys.stderr,
        )
        sleeper(delay)

    return 1


def positive_number_from_environment(name: str, default: float, maximum: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be a number") from error
    if not math.isfinite(value) or value <= 0 or value > maximum:
        raise ValueError(f"{name} must be greater than zero and no more than {maximum:g}")
    return value


def positive_integer_from_environment(name: str, default: int, maximum: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer") from error
    if value <= 0 or value > maximum:
        raise ValueError(f"{name} must be greater than zero and no more than {maximum}")
    return value


def main(argv: Sequence[str]) -> int:
    if len(argv) < 2:
        print("Usage: imagegen_retry.py IMAGE_GEN_SCRIPT COMMAND [ARGS...]", file=sys.stderr)
        return 2

    image_generator = Path(argv[0])
    if not image_generator.is_file():
        print(f"Image generator not found: {image_generator}", file=sys.stderr)
        return 2

    try:
        max_attempts = positive_integer_from_environment("IMAGEGEN_MAX_ATTEMPTS", 3, 5)
        retry_base_seconds = positive_number_from_environment("IMAGEGEN_RETRY_BASE_SECONDS", 2, 30)
    except ValueError as error:
        print(f"imagegen retry configuration is invalid: {error}", file=sys.stderr)
        return 2

    return run_with_retries(
        str(image_generator),
        argv[1:],
        max_attempts=max_attempts,
        retry_base_seconds=retry_base_seconds,
    )


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
