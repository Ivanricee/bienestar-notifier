import { Vision } from "./vision.ts";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { classifiedImages } from "./imgClassifier.ts";
import { ScrapeImagesType } from "./scraper.ts";
import { responseSchema } from "./schemas/classified-image-schema.ts";
import { classifiedImagesPrompt } from "./prompt/classifiedInterestImageUrls.ts";
export interface Decision extends Vision {
  topic: string;
}
/**
 * Makes a decision based on the vision
│   ├── matcher.js         ← ¿A quién le interesa?
 * @param visions The visions to make a decision from
 * @returns The decision
 */
export const makeDecision = async (visions: Vision[]): Promise<Decision[]> => {
  return [];
};
export async function reasoningClassifyImages(
  scrapedImages: ScrapeImagesType[]
): Promise<classifiedImages[]> {
  if (scrapedImages.length === 0) return [];

  const { object } = await generateObject({
    model: google("gemini-3-flash-preview"), // cambia a gemini-3.1-flash cuando esté disponible
    schema: responseSchema,
    prompt: classifiedImagesPrompt(scrapedImages),
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: false,
          thinkingLevel: "low",
        },
      },
    },
  });
  console.log("------------------------------------------------------");
  console.log("object: ", object.results);
  console.log("------------------------------------------------------");
  return object.results as classifiedImages[];
}
