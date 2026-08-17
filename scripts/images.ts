import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assert, resolveWithin } from "./site.ts";

interface ResponsiveImageSpec {
  source: string;
  widths: readonly number[];
  quality: number;
}

const responsiveImages: readonly ResponsiveImageSpec[] = [
  {
    source: "assets/images/profile.jpg",
    widths: [400, 800],
    quality: 82,
  },
];

/** Generates responsive WebP derivatives in the build output while preserving original source assets. */
export async function generateResponsiveImages(sourceRoot: string, outputRoot: string): Promise<void> {
  for (const image of responsiveImages) {
    const input = resolveWithin(sourceRoot, image.source);
    const metadata = await sharp(input).metadata();
    const largestWidth = Math.max(...image.widths);
    assert(
      typeof metadata.width === "number" && metadata.width >= largestWidth,
      `${image.source} must be at least ${largestWidth}px wide`,
    );

    const parsed = path.parse(image.source);
    const outputDirectory = resolveWithin(outputRoot, parsed.dir);
    await fs.mkdir(outputDirectory, { recursive: true });

    await Promise.all(
      image.widths.map((width) =>
        sharp(input)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: image.quality, effort: 6 })
          .toFile(path.join(outputDirectory, `${parsed.name}-${width}.webp`)),
      ),
    );
  }
}
