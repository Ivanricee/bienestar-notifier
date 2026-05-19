import type { VercelRequest, VercelResponse } from "@vercel/node";
import { scrapeImages, type ScrapeImagesType } from "../src/lib/scraper.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const scraped: ScrapeImagesType[] = await scrapeImages("https://www.gob.mx/bienestar");
  res.json(scraped);
}
