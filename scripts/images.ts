import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assert, resolveWithin } from "./site.ts";
import type { OtherImage, OtherSection } from "./types.ts";

export interface PreparedOtherImage extends OtherImage {
  width: number;
  height: number;
}

export interface PreparedOtherSection extends Omit<OtherSection, "images"> {
  images: PreparedOtherImage[];
}

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

/** Returns the generated widths used for an Other page source image. */
export function otherImageWidths(sourceWidth: number): number[] {
  const maximumWidth = Math.min(sourceWidth, 1600);
  return [...new Set([480, 960, maximumWidth].filter((width) => width <= maximumWidth))];
}

/** Returns the root-relative WebP derivative path for a source image and width. */
export function imageVariantPath(sourcePath: string, width: number): string {
  const parsed = path.posix.parse(sourcePath);
  return path.posix.join(parsed.dir, `${parsed.name}-${width}.webp`);
}

/** Reads source dimensions once so rendering and image generation share the same metadata. */
export async function prepareOtherSections(
  sourceRoot: string,
  sections: OtherSection[],
): Promise<PreparedOtherSection[]> {
  return Promise.all(
    sections.map(async (section) => ({
      ...section,
      images: await Promise.all(
        section.images.map(async (image) => {
          const input = resolveWithin(sourceRoot, image.image.replace(/^\//, ""));
          const metadata = await sharp(input).metadata();
          const { width, height } = metadata.autoOrient;
          assert(width > 0 && height > 0, `${image.image} must have valid intrinsic dimensions`);
          return { ...image, width, height };
        }),
      ),
    })),
  );
}

/** Generates responsive WebP derivatives in the build output while preserving original source assets. */
export async function generateResponsiveImages(
  sourceRoot: string,
  outputRoot: string,
  otherSections: PreparedOtherSection[],
): Promise<void> {
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

  for (const section of otherSections) {
    for (const image of section.images) {
      const input = resolveWithin(sourceRoot, image.image.replace(/^\//, ""));

      await Promise.all(
        otherImageWidths(image.width).map((width) => {
          const output = resolveWithin(outputRoot, imageVariantPath(image.image, width).replace(/^\//, ""));
          return fs
            .mkdir(path.dirname(output), { recursive: true })
            .then(() =>
              sharp(input)
                .rotate()
                .resize({ width, withoutEnlargement: true })
                .webp({ quality: 82, effort: 6 })
                .toFile(output),
            );
        }),
      );
    }
  }
}
