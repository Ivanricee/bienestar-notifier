import { generateText } from "ai";
import { classifiedImages } from "./imgClassifier.js";
import { visionPrompt } from "./prompt/classifiedVisionImage.js";
import { VisionResult } from "./schemas/classified-vision-image-schema.js";
import { groq } from "@ai-sdk/groq";
import { ACTIVE_TOPICS, TOPICS } from "../storage/data.js";

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url);
}

function getCloudinaryUrl(url: string, addBase: boolean): string {
  const base = addBase ? "https://www.gob.mx" : "";
  const cloudinary = "https://res.cloudinary.com/ivanrice-c/image/fetch/";
  const transformation = "c_limit,w_1120,h_1120,f_webp,q_auto/";
  return `${cloudinary}${transformation}${base}${url}`;
}

function buildCloudinaryUrl(image: classifiedImages): string {
  if (isImageUrl(image.onclick)) return getCloudinaryUrl(image.onclick, false);
  return getCloudinaryUrl(image.thumbnail_url, true);
}

function parseVisionResult(text: string, image: classifiedImages): VisionResult | null {
  try {
    // limpiar posibles markdown code blocks que el LLM añada
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // validar campos mínimos necesarios
    if (typeof parsed.confirmed !== "boolean") return null;
    if (typeof parsed.id !== "string") return null;
    if (typeof parsed.id_topic !== "string") return null;
    if (typeof parsed.id_topic_confidence !== "number") return null;

    return {
      id: parsed.id,
      onclick: parsed.onclick ?? image.onclick,
      thumbnail_url: parsed.thumbnail_url ?? image.thumbnail_url,
      id_topic: parsed.id_topic,
      id_topic_confidence: parsed.id_topic_confidence,
      confirmed: parsed.confirmed,
      extracted_data: parsed.extracted_data ?? {},
      template_msg: parsed.template_msg ?? "",
    } as VisionResult;
  } catch {
    return null;
  }
}

export async function analyzeImagesWithVision(
  visionImages: classifiedImages[]
): Promise<VisionResult[]> {
  const activeTopics = new Set(ACTIVE_TOPICS);

  if (visionImages.length === 0) return [];

  const sortedImages = [...visionImages].sort((a, b) => {
    if (a.id_topic !== "" && b.id_topic === "") return -1;
    if (a.id_topic === "" && b.id_topic !== "") return 1;
    return 0;
  });

  const CONFIDENCE_THRESHOLD: Record<string, number> = {
    exact: 0.85,
    semantic: 0.65,
  };

  const bestRankedByTopics = new Map<string, VisionResult>();
  console.log("-----------------------------------------------------");
  console.log("sortedImages vision: ", sortedImages);
  console.log("-----------------------------------------------------");
  for (const image of sortedImages) {
    if (activeTopics.size === 0) break;
    if (image.id_topic !== "" && !activeTopics.has(image.id_topic)) continue;

    const cloudinaryUrl = buildCloudinaryUrl(image);

    try {
      const { text } = await generateText({
        model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: visionPrompt(image, TOPICS) },
              { type: "image", image: cloudinaryUrl },
            ],
          },
        ],
      });

      const object = parseVisionResult(text, image);
      if (!object) {
        console.error(`Vision parse failed for image ${image.id}`);
        continue;
      }

      if (object.confirmed && activeTopics.has(object.id_topic)) {
        const matchedTopic = TOPICS.find((topic) => topic.id === object.id_topic);
        const threshold = CONFIDENCE_THRESHOLD[matchedTopic!.type];

        const existing = bestRankedByTopics.get(object.id_topic);
        if (!existing || object.id_topic_confidence > existing.id_topic_confidence) {
          bestRankedByTopics.set(object.id_topic, object);
        }

        if (object.id_topic_confidence >= threshold) {
          activeTopics.delete(object.id_topic);
        }
      }
    } catch (error) {
      console.error(`Vision failed for image ${image.id}:`, error);
    }
  }
  console.log("-----------------------------------------------------");
  console.log("bestRankedByTopics values: ", Array.from(bestRankedByTopics.values()));
  console.log("-----------------------------------------------------");
  return Array.from(bestRankedByTopics.values());
}
