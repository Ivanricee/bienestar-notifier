import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeImagesWithVision } from "../src/lib/vision.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const visionResult = await analyzeImagesWithVision();
  res.json(visionResult);
}
