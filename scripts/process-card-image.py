#!/usr/bin/env python3
"""Rectify, enhance, redact, and export a photographed card."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def order_corners(points: np.ndarray) -> np.ndarray:
    points = np.asarray(points, dtype=np.float32).reshape(4, 2)
    coordinate_sums = points.sum(axis=1)
    coordinate_differences = np.diff(points, axis=1).ravel()
    ordered = np.array(
        [
            points[np.argmin(coordinate_sums)],
            points[np.argmin(coordinate_differences)],
            points[np.argmax(coordinate_sums)],
            points[np.argmax(coordinate_differences)],
        ],
        dtype=np.float32,
    )
    top_width = np.linalg.norm(ordered[1] - ordered[0])
    right_height = np.linalg.norm(ordered[2] - ordered[1])
    if right_height > top_width:
        ordered = np.array([ordered[3], ordered[0], ordered[1], ordered[2]])
    return ordered


def parse_points(value: str) -> np.ndarray:
    points = [tuple(map(float, pair.split(","))) for pair in value.split()]
    if len(points) != 4 or any(len(point) != 2 for point in points):
        raise argparse.ArgumentTypeError(
            "corners must contain four x,y pairs ordered top-left, top-right, bottom-right, bottom-left"
        )
    return order_corners(np.float32(points))


def parse_rectangle(value: str) -> tuple[int, int, int, int]:
    coordinates = tuple(map(int, value.split(",")))
    if len(coordinates) != 4:
        raise argparse.ArgumentTypeError("redactions must use left,top,right,bottom")
    left, top, right, bottom = coordinates
    if left < 0 or top < 0 or right <= left or bottom <= top:
        raise argparse.ArgumentTypeError("redaction coordinates must define a positive rectangle")
    return left, top, right, bottom


def adjust_lighting(image: np.ndarray, gamma: float) -> np.ndarray:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, a, b = cv2.split(lab)
    lightness = np.power(lightness / 255, gamma) * 255
    return cv2.cvtColor(
        cv2.merge((lightness.astype(np.uint8), a, b)),
        cv2.COLOR_LAB2BGR,
    )


def edge_support(corners: np.ndarray, edges: np.ndarray) -> float:
    line_mask = np.zeros(edges.shape, dtype=np.uint8)
    cv2.polylines(line_mask, [corners.astype(np.int32)], True, 255, 7)
    expanded_edges = cv2.dilate(edges, np.ones((9, 9), np.uint8))
    line_pixels = cv2.countNonZero(line_mask)
    if not line_pixels:
        return 0
    return cv2.countNonZero(cv2.bitwise_and(line_mask, expanded_edges)) / line_pixels


def line_coefficients(start: np.ndarray, end: np.ndarray) -> np.ndarray:
    delta = end - start
    length = np.linalg.norm(delta)
    return np.array(
        [delta[1] / length, -delta[0] / length, 0],
        dtype=np.float32,
    ) + np.array([0, 0, -(delta[1] * start[0] - delta[0] * start[1]) / length])


def intersect_lines(first: np.ndarray, second: np.ndarray) -> np.ndarray | None:
    determinant = first[0] * second[1] - second[0] * first[1]
    if abs(determinant) < 1e-5:
        return None
    return np.array(
        [
            (first[1] * second[2] - second[1] * first[2]) / determinant,
            (first[2] * second[0] - second[2] * first[0]) / determinant,
        ],
        dtype=np.float32,
    )


def refine_corners_with_lines(corners: np.ndarray, gray: np.ndarray) -> np.ndarray:
    edges = cv2.Canny(gray, 15, 60)
    short_side = min(
        np.linalg.norm(corners[1] - corners[0]),
        np.linalg.norm(corners[2] - corners[1]),
    )
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 720,
        threshold=max(40, round(short_side * 0.07)),
        minLineLength=round(short_side * 0.25),
        maxLineGap=round(short_side * 0.15),
    )
    if lines is None:
        return corners

    detected_lines = lines.reshape(-1, 4)
    refined_sides: list[np.ndarray] = []
    search_distance = short_side * 0.15
    for index in range(4):
        start = corners[index]
        end = corners[(index + 1) % 4]
        expected = line_coefficients(start, end)
        expected_length = np.linalg.norm(end - start)
        expected_angle = np.arctan2(end[1] - start[1], end[0] - start[0])
        best: tuple[float, np.ndarray] | None = None

        for x1, y1, x2, y2 in detected_lines:
            candidate_start = np.array([x1, y1], dtype=np.float32)
            candidate_end = np.array([x2, y2], dtype=np.float32)
            candidate_delta = candidate_end - candidate_start
            candidate_length = np.linalg.norm(candidate_delta)
            candidate_angle = np.arctan2(candidate_delta[1], candidate_delta[0])
            angle_difference = abs(
                np.arctan2(
                    np.sin(candidate_angle - expected_angle),
                    np.cos(candidate_angle - expected_angle),
                )
            )
            angle_difference = min(angle_difference, np.pi - angle_difference)
            if angle_difference > np.deg2rad(12):
                continue

            midpoint = (candidate_start + candidate_end) / 2
            distance = abs(expected[0] * midpoint[0] + expected[1] * midpoint[1] + expected[2])
            if distance > search_distance:
                continue

            score = candidate_length / expected_length - 0.5 * distance / search_distance
            candidate = line_coefficients(candidate_start, candidate_end)
            if best is None or score > best[0]:
                best = (score, candidate)

        refined_sides.append(expected if best is None else best[1])

    refined = []
    maximum_shift = short_side * 0.15
    for index, original in enumerate(corners):
        intersection = intersect_lines(refined_sides[index - 1], refined_sides[index])
        if intersection is None or np.linalg.norm(intersection - original) > maximum_shift:
            refined.append(original)
        else:
            refined.append(intersection)
    return np.array(refined, dtype=np.float32)


def detect_corners(source: np.ndarray, aspect_ratio: float) -> tuple[np.ndarray, float]:
    maximum_dimension = max(source.shape[:2])
    scale = min(1, 1600 / maximum_dimension)
    preview = cv2.resize(source, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    height, width = preview.shape[:2]
    hsv = cv2.cvtColor(preview, cv2.COLOR_BGR2HSV)
    gray = cv2.GaussianBlur(cv2.cvtColor(preview, cv2.COLOR_BGR2GRAY), (5, 5), 0)

    edge_maps: list[np.ndarray] = []
    for channel in [gray, hsv[:, :, 1], hsv[:, :, 2]]:
        for low, high in [(15, 45), (30, 90), (60, 160)]:
            edges = cv2.Canny(channel, low, high)
            edge_maps.append(
                cv2.morphologyEx(
                    edges,
                    cv2.MORPH_CLOSE,
                    np.ones((7, 7), np.uint8),
                    iterations=2,
                )
            )

    border = np.concatenate(
        [
            preview[: max(1, height // 20), :].reshape(-1, 3),
            preview[-max(1, height // 20) :, :].reshape(-1, 3),
            preview[:, : max(1, width // 20)].reshape(-1, 3),
            preview[:, -max(1, width // 20) :].reshape(-1, 3),
        ]
    )
    background = np.median(border.astype(np.float32), axis=0)
    color_distance = np.linalg.norm(preview.astype(np.float32) - background, axis=2)
    for threshold in [18, 28, 40]:
        mask = np.where(color_distance >= threshold, 255, 0).astype(np.uint8)
        edge_maps.append(
            cv2.morphologyEx(
                mask,
                cv2.MORPH_CLOSE,
                np.ones((21, 21), np.uint8),
                iterations=2,
            )
        )

    combined_edges = cv2.dilate(
        cv2.Canny(gray, 30, 100),
        np.ones((5, 5), np.uint8),
    )
    image_area = width * height
    margin = min(width, height) * 0.012
    candidates: list[tuple[float, np.ndarray]] = []

    for edge_map in edge_maps:
        contours, _ = cv2.findContours(edge_map, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            contour_area = cv2.contourArea(contour)
            area_fraction = contour_area / image_area
            if not 0.08 <= area_fraction <= 0.82:
                continue

            hull = cv2.convexHull(contour)
            perimeter = cv2.arcLength(hull, True)
            quadrilaterals: list[np.ndarray] = []
            for epsilon in [0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.065]:
                approximation = cv2.approxPolyDP(hull, epsilon * perimeter, True)
                if len(approximation) == 4 and cv2.isContourConvex(approximation):
                    quadrilaterals.append(approximation[:, 0, :])
                    break
            quadrilaterals.append(cv2.boxPoints(cv2.minAreaRect(hull)))

            for points in quadrilaterals:
                corners = order_corners(points)
                if (
                    np.any(corners[:, 0] < margin)
                    or np.any(corners[:, 0] > width - margin)
                    or np.any(corners[:, 1] < margin)
                    or np.any(corners[:, 1] > height - margin)
                ):
                    continue

                top_width = np.linalg.norm(corners[1] - corners[0])
                bottom_width = np.linalg.norm(corners[2] - corners[3])
                left_height = np.linalg.norm(corners[3] - corners[0])
                right_height = np.linalg.norm(corners[2] - corners[1])
                detected_ratio = ((top_width + bottom_width) / 2) / (
                    (left_height + right_height) / 2
                )
                ratio_score = np.exp(-abs(np.log(detected_ratio / aspect_ratio)) * 4)
                rectangle_area = cv2.contourArea(corners)
                rectangularity = min(1, contour_area / max(rectangle_area, 1))
                support = edge_support(corners, combined_edges)
                area_score = min(1, area_fraction / 0.25)
                confidence = (
                    0.45 * ratio_score
                    + 0.3 * support
                    + 0.2 * rectangularity
                    + 0.05 * area_score
                )
                candidates.append((float(confidence), corners / scale))

    if not candidates:
        raise ValueError("unable to find a card-shaped quadrilateral")

    confidence, corners = max(candidates, key=lambda candidate: candidate[0])
    if confidence < 0.55:
        raise ValueError(f"automatic corner detection confidence is too low ({confidence:.2f})")
    refined = refine_corners_with_lines(corners * scale, gray) / scale
    return refined, confidence


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JPEG, PNG, TIFF, or other OpenCV-readable source")
    parser.add_argument("output", type=Path, help="Output image; .webp is recommended")
    corner_source = parser.add_mutually_exclusive_group()
    corner_source.add_argument(
        "--corners",
        type=parse_points,
        help='source pixels as "TLx,TLy TRx,TRy BRx,BRy BLx,BLy"',
    )
    corner_source.add_argument(
        "--auto",
        action="store_true",
        help="detect the card boundary automatically; fails safely when confidence is low",
    )
    parser.add_argument("--width", type=int, default=1600, help="output width (default: 1600)")
    parser.add_argument(
        "--aspect-ratio",
        type=float,
        default=85.60 / 53.98,
        help="output width divided by height (default: standard card ratio)",
    )
    parser.add_argument(
        "--gamma",
        type=float,
        default=1,
        help="lighting adjustment; below 1 brightens shadows (default: 1)",
    )
    parser.add_argument(
        "--padding",
        type=int,
        default=36,
        help="surrounding surface retained around the card in pixels (default: 36)",
    )
    parser.add_argument(
        "--redact",
        action="append",
        default=[],
        type=parse_rectangle,
        metavar="LEFT,TOP,RIGHT,BOTTOM",
        help="blur an output-coordinate rectangle; may be repeated",
    )
    parser.add_argument("--quality", type=int, default=88, help="WebP/JPEG quality (default: 88)")
    args = parser.parse_args()

    if args.width <= 0 or args.aspect_ratio <= 0 or args.gamma <= 0 or args.padding < 0:
        parser.error("width, aspect ratio, and gamma must be positive; padding cannot be negative")
    if not 1 <= args.quality <= 100:
        parser.error("quality must be between 1 and 100")

    source = cv2.imread(str(args.input), cv2.IMREAD_COLOR)
    if source is None:
        parser.error(
            f"unable to read {args.input}; convert HEIC files to TIFF or JPEG before processing"
        )

    corners = args.corners
    if corners is None:
        try:
            corners, confidence = detect_corners(source, args.aspect_ratio)
        except ValueError as error:
            parser.error(f"{error}; provide --corners to override automatic detection")
        print(
            "Detected corners "
            + " ".join(f"{round(x)},{round(y)}" for x, y in corners)
            + f" (confidence {confidence:.2f})"
        )

    height = round(args.width / args.aspect_ratio)
    canvas_width = args.width + 2 * args.padding
    canvas_height = height + 2 * args.padding
    destination = np.float32(
        [
            (args.padding, args.padding),
            (args.padding + args.width - 1, args.padding),
            (args.padding + args.width - 1, args.padding + height - 1),
            (args.padding, args.padding + height - 1),
        ]
    )
    transform = cv2.getPerspectiveTransform(corners, destination)
    rectified = cv2.warpPerspective(
        source,
        transform,
        (canvas_width, canvas_height),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_REPLICATE,
    )
    adjusted = adjust_lighting(rectified, args.gamma)

    for left, top, right, bottom in args.redact:
        left += args.padding
        right += args.padding
        top += args.padding
        bottom += args.padding
        if right > canvas_width or bottom > canvas_height:
            parser.error(f"redaction {left},{top},{right},{bottom} exceeds output dimensions")
        region_width = right - left
        if left < canvas_width / 2:
            source_left = min(right + 40, canvas_width - region_width)
        else:
            source_left = max(0, left - region_width - 40)
        source = adjusted[top:bottom, source_left : source_left + region_width].copy()
        mask = np.full(source.shape[:2], 255, dtype=np.uint8)
        center = ((left + right) // 2, (top + bottom) // 2)
        adjusted = cv2.seamlessClone(source, adjusted, mask, center, cv2.NORMAL_CLONE)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    options = [cv2.IMWRITE_WEBP_QUALITY, args.quality]
    if args.output.suffix.lower() in {".jpg", ".jpeg"}:
        options = [cv2.IMWRITE_JPEG_QUALITY, args.quality]
    if not cv2.imwrite(str(args.output), adjusted, options):
        raise RuntimeError(f"unable to write {args.output}")


if __name__ == "__main__":
    main()
