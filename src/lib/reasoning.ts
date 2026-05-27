import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { classifiedImages } from "./imgClassifier.js";
import { ScrapeImagesType } from "./scraper.js";
import { responseSchema } from "./schemas/classified-image-schema.js";
import { classifiedImagesPrompt } from "./prompt/classifiedInterestImageUrls.js";
import { VisionResult } from "./schemas/classified-vision-image-schema.js";
import { visionTemplateSchema } from "./schemas/vision-template.js";
import { visionTemplatePrompt } from "./prompt/visionTemplate.js";
/*const visionResults: VisionResult[] = [
  {
    id: "de9efd34-93e8-40ec-9d45-0049e764e9ee",
    onclick: "https://www.gob.mx/cms/uploads/image/file/1071840/IMG-20260503-WA0008.jpg",
    thumbnail_url: "/cms/uploads/identity/image/51298/IMG-20260503-WA0005.jpg",
    id_topic: "calendario_pension",
    id_topic_confidence: 1,
    confirmed: true,
    extracted_data: [
      {
        letra: "A",
        dia: "lunes",
        fecha: "4 de mayo",
      },
      {
        letra: "B",
        dia: "martes",
        fecha: "5 de mayo",
      },
      {
        letra: "C",
        dia: "miércoles",
        fecha: "6 de mayo",
      },
      {
        letra: "C",
        dia: "jueves",
        fecha: "7 de mayo",
      },
      {
        letra: "D,E,F",
        dia: "viernes",
        fecha: "8 de mayo",
      },
      {
        letra: "G",
        dia: "lunes",
        fecha: "11 de mayo",
      },
      {
        letra: "G",
        dia: "martes",
        fecha: "12 de mayo",
      },
      {
        letra: "H,I,J,K",
        dia: "miércoles",
        fecha: "13 de mayo",
      },
      {
        letra: "L",
        dia: "jueves",
        fecha: "14 de mayo",
      },
      {
        letra: "M",
        dia: "viernes",
        fecha: "15 de mayo",
      },
      {
        letra: "M",
        dia: "lunes",
        fecha: "18 de mayo",
      },
      {
        letra: "N,Ñ,O",
        dia: "martes",
        fecha: "19 de mayo",
      },
      {
        letra: "P,Q",
        dia: "miércoles",
        fecha: "20 de mayo",
      },
      {
        letra: "R",
        dia: "jueves",
        fecha: "21 de mayo",
      },
      {
        letra: "R",
        dia: "viernes",
        fecha: "22 de mayo",
      },
      {
        letra: "S",
        dia: "lunes",
        fecha: "25 de mayo",
      },
      {
        letra: "T,U,V",
        dia: "martes",
        fecha: "26 de mayo",
      },
      {
        letra: "W,X,Y,Z",
        dia: "miércoles",
        fecha: "27 de mayo",
      },
    ],
    template_msg: "",
  },
];*/
export interface ClassifiedImagesResult {
  results: classifiedImages[];
  error: string | null;
}

export async function reasoningClassifyImages(
  scrapedImages: ScrapeImagesType[]
): Promise<ClassifiedImagesResult> {
  if (scrapedImages.length === 0) {
    return { results: [], error: null };
  }

  try {
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

    if (!object.results || !Array.isArray(object.results)) {
      return { results: [], error: "Invalid response format from AI model" };
    }

    return { results: object.results as classifiedImages[], error: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during image classification";
    console.error("Error in reasoningClassifyImages:", errorMessage);

    if (error instanceof Error && error.message.includes("rate limit")) {
      return { results: [], error: "Rate limit exceeded. Please try again later." };
    }

    if (error instanceof Error && error.message.includes("timeout")) {
      return { results: [], error: "Request timed out. The AI service may be unavailable." };
    }

    return { results: [], error: errorMessage };
  }
}
export async function generateTemplates(visionResults: VisionResult[]) {
  if (visionResults.length === 0) return [];

  try {
    const { object } = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: visionTemplateSchema,
      prompt: visionTemplatePrompt(visionResults),
    });

    console.log("-------------object.messages: -----------------");
    console.log("object: ", object.messages);
    console.log("-------------.------------: -----------------");
    return object.messages;
  } catch (error) {
    console.error("Fase2 template generation failed:", error);
    return [];
  }
}
