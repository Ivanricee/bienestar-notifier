import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClassifiedImages } from "../src/lib/imgClassifier.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const imageMatched = await getClassifiedImages();
  res.json(imageMatched);
}
