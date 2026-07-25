from __future__ import annotations

from contextlib import redirect_stderr
import io
import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("imagegen_retry.py")
SPEC = importlib.util.spec_from_file_location("imagegen_retry", SCRIPT)
assert SPEC and SPEC.loader
imagegen_retry = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(imagegen_retry)


def result(code: int, stderr: str = "") -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(["image_gen.py"], code, "", stderr)


class ImagegenRetryTests(unittest.TestCase):
    def run_script(self, command: list[str], responses: list[subprocess.CompletedProcess[str]]):
        calls: list[list[str]] = []
        waits: list[float] = []

        def runner(args, **_):
            calls.append(args)
            return responses.pop(0)

        with patch.object(imagegen_retry, "relay_output"), redirect_stderr(io.StringIO()):
            code = imagegen_retry.run_with_retries(
                "image_gen.py",
                command,
                max_attempts=3,
                retry_base_seconds=0.25,
                runner=runner,
                sleeper=waits.append,
            )
        return code, calls, waits

    def test_retries_provider_disconnect_then_succeeds(self):
        code, calls, waits = self.run_script(
            ["generate", "--prompt", "gum"],
            [
                result(1, "httpx.RemoteProtocolError: Server disconnected without sending a response"),
                result(0),
            ],
        )
        self.assertEqual(code, 0)
        self.assertEqual(len(calls), 2)
        self.assertEqual(waits, [0.25])

    def test_retries_openai_upstream_status_error_then_succeeds(self):
        code, calls, waits = self.run_script(
            ["generate", "--prompt", "gum"],
            [
                result(1, "openai.InternalServerError: Error code: 502 - {'error': {'type': 'upstream_error'}}"),
                result(0),
            ],
        )
        self.assertEqual(code, 0)
        self.assertEqual(len(calls), 2)
        self.assertEqual(waits, [0.25])

    def test_does_not_retry_permanent_request_errors(self):
        code, calls, waits = self.run_script(
            ["edit", "--image", "missing.png"],
            [result(1, "Error: Image file not found: missing.png")],
        )
        self.assertEqual(code, 1)
        self.assertEqual(len(calls), 1)
        self.assertEqual(waits, [])

    def test_does_not_wrap_batch_or_dry_run_requests(self):
        batch_code, batch_calls, batch_waits = self.run_script(
            ["generate-batch", "--input", "jobs.jsonl"],
            [result(1, "RemoteProtocolError: Server disconnected")],
        )
        dry_code, dry_calls, dry_waits = self.run_script(
            ["generate", "--dry-run", "--prompt", "gum"],
            [result(1, "RemoteProtocolError: Server disconnected")],
        )
        self.assertEqual((batch_code, len(batch_calls), batch_waits), (1, 1, []))
        self.assertEqual((dry_code, len(dry_calls), dry_waits), (1, 1, []))

    def test_identifies_only_known_transport_failures(self):
        self.assertTrue(imagegen_retry.is_retryable_transport_error("429 rate limit"))
        self.assertTrue(imagegen_retry.is_retryable_transport_error("connection reset by peer"))
        self.assertFalse(imagegen_retry.is_retryable_transport_error("prompt is required"))

    def test_retry_attempt_count_requires_a_positive_integer(self):
        with patch.dict("os.environ", {"IMAGEGEN_MAX_ATTEMPTS": "2.5"}, clear=True):
            with self.assertRaisesRegex(ValueError, "integer"):
                imagegen_retry.positive_integer_from_environment("IMAGEGEN_MAX_ATTEMPTS", 3, 5)

    def test_retry_delay_requires_a_finite_positive_number(self):
        with patch.dict("os.environ", {"IMAGEGEN_RETRY_BASE_SECONDS": "nan"}, clear=True):
            with self.assertRaisesRegex(ValueError, "greater than zero"):
                imagegen_retry.positive_number_from_environment("IMAGEGEN_RETRY_BASE_SECONDS", 2, 30)


if __name__ == "__main__":
    unittest.main()
