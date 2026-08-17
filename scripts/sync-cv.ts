import fs from "node:fs/promises";
import path from "node:path";
import { root } from "./site.ts";

const sourceUrl = "https://raw.githubusercontent.com/Michaelmvh/CV/main/CV.pdf";
const destination = path.join(root, "src", "assets", "documents", "CV.pdf");
const response = await fetch(sourceUrl);

if (!response.ok) {
  throw new Error(`Unable to download the current CV: ${response.status} ${response.statusText}`);
}

const content = Buffer.from(await response.arrayBuffer());
if (!content.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
  throw new Error("The downloaded CV is not a valid PDF.");
}

await fs.writeFile(destination, content);
console.log(`Updated ${path.relative(root, destination)}.`);
