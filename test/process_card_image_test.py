import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "process-card-image.py"


class RedactionTests(unittest.TestCase):
    def run_processor(self, directory, image, rectangles=(), padding=None, output_name="output.png"):
        source = directory / "source.png"
        output = directory / output_name
        self.assertTrue(cv2.imwrite(str(source), image))
        command = [
            sys.executable, str(SCRIPT), str(source), str(output),
            "--corners", "0,0 319,0 319,159 0,159",
            "--width", "320", "--aspect-ratio", "2",
        ]
        if padding is not None:
            command.extend(["--padding", str(padding)])
        for rectangle in rectangles:
            command.append("--redact=" + ",".join(map(str, rectangle)))
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        return result, output

    def test_blended_redaction_uses_final_output_coordinates(self):
        cases = [
            (None, [(80, 70, 120, 96)]),
            (0, [(80, 70, 120, 96)]),
            (12, [(220, 70, 261, 97)]),
            (None, [(80, 70, 120, 96), (240, 120, 280, 146)]),
        ]
        for padding, rectangles in cases:
            with self.subTest(padding=padding, rectangles=rectangles), tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp)
                margin = 36 if padding is None else padding
                image = np.full((160, 320, 3), (170, 190, 210), dtype=np.uint8)
                for left, top, right, bottom in rectangles:
                    image[
                        top - margin + 6:bottom - margin - 6,
                        left - margin + 6:right - margin - 6,
                    ] = 20
                baseline_result, baseline_path = self.run_processor(
                    directory, image, padding=padding, output_name="baseline.png"
                )
                self.assertEqual(baseline_result.returncode, 0, baseline_result.stderr)
                result, output = self.run_processor(directory, image, rectangles, padding)
                self.assertEqual(result.returncode, 0, result.stderr)
                baseline = cv2.imread(str(baseline_path))
                redacted = cv2.imread(str(output))
                self.assertEqual(redacted.shape, (160 + 2 * margin, 320 + 2 * margin, 3))
                outside = np.ones(redacted.shape[:2], dtype=bool)
                for left, top, right, bottom in rectangles:
                    original = baseline[top:bottom, left:right]
                    replacement = redacted[top:bottom, left:right]
                    dark_before = np.count_nonzero(np.all(original < 80, axis=2))
                    dark_after = np.count_nonzero(np.all(replacement < 80, axis=2))
                    self.assertGreater(dark_before, 100)
                    self.assertLess(dark_after, dark_before * 0.05)
                    self.assertGreater(float(replacement.mean()), 140, "Redaction must blend, not black out")
                    outside[top:bottom, left:right] = False
                np.testing.assert_array_equal(redacted[outside], baseline[outside])

    def test_rectangles_at_output_boundaries_are_accepted(self):
        image = np.full((160, 320, 3), 180, dtype=np.uint8)
        for rectangle in [(0, 0, 40, 30), (280, 130, 320, 160)]:
            with self.subTest(rectangle=rectangle), tempfile.TemporaryDirectory() as tmp:
                result, output = self.run_processor(Path(tmp), image, [rectangle], padding=0)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(output.is_file())

    def test_invalid_rectangles_fail_without_writing_output(self):
        image = np.full((160, 320, 3), 180, dtype=np.uint8)
        for rectangle in [
            (-1, 0, 40, 30), (10, 10, 10, 30), (20, 10, 10, 30),
            (0, 0, 393, 30), (0, 0, 40, 233),
        ]:
            with self.subTest(rectangle=rectangle), tempfile.TemporaryDirectory() as tmp:
                result, output = self.run_processor(Path(tmp), image, [rectangle])
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("redaction", result.stderr)
                self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
