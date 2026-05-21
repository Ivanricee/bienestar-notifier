import { generateObject } from "ai";
import { classifiedImages } from "./imgClassifier.js";
import { visionPrompt } from "./prompt/classifiedVisionImage.js";
import { VisionResult, visionResultSchema } from "./schemas/classified-vision-image-schema.js";
import { groq } from "@ai-sdk/groq";
import { ACTIVE_TOPICS, TOPICS } from "../storage/data.js";

// ------------------------------------------------
// HELPERS
// ------------------------------------------------
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
  // onclick es imagen directa — sin baseUrl
  if (isImageUrl(image.onclick)) return getCloudinaryUrl(image.onclick, false);

  // onclick no es imagen — usar thumbnail con baseUrl
  return getCloudinaryUrl(image.thumbnail_url, true);
}
/*const visionImages: classifiedImages[] = [
  {
    id: "de9efd34-93e8-40ec-9d45-0049e764e9ee",
    onclick: "https://www.gob.mx/cms/uploads/image/file/1071840/IMG-20260503-WA0008.jpg",
    thumbnail_url: "/cms/uploads/identity/image/51298/IMG-20260503-WA0005.jpg",
    id_topic: "",
  },
  {
    id: "8f9ccd3d-3339-4ffb-82f2-23475afd9649",
    onclick: "http://200.188.126.15:8082/UBICA_TU_PAGO.bienestar/index/",
    thumbnail_url: "/cms/uploads/identity/image/51299/IMG-20260503-WA0003.jpg",
    id_topic: "calendario_pension",
  },
];*/
// ------------------------------------------------
// FASE 1 — VISION
// ------------------------------------------------
export async function analyzeImagesWithVision(
  visionImages: classifiedImages[]
): Promise<VisionResult[]> {
  const activeTopics = new Set(ACTIVE_TOPICS);
  //visionImages: classifiedImages[],

  if (visionImages.length === 0) return [];
  const sortedImages = [...visionImages].sort((a, b) => {
    if (a.id_topic !== "" && b.id_topic === "") return -1;
    if (a.id_topic === "" && b.id_topic !== "") return 1;
    return 0;
  });
  // 3 — threshold por tipo de topic
  const CONFIDENCE_THRESHOLD: Record<string, number> = {
    exact: 0.85,
    semantic: 0.65,
  };
  //guardar mejor resultado por topic
  const bestRankedByTopics = new Map<string, VisionResult>();

  for (const image of sortedImages) {
    // si ya no hay topics pendientes, salir
    if (activeTopics.size === 0) break;
    // si esta imagen ya tiene id_topic y ese topic ya fue cubierto, skip
    if (image.id_topic !== "" && !activeTopics.has(image.id_topic)) continue;
    const cloudinaryUrl = buildCloudinaryUrl(image);

    try {
      //debug 1 url iamges | sorted images
      /*console.log("Debug 1 sorted images------------------");
      console.log("sortedImages", { sortedImages, cloudinaryUrl });
      console.log("---------------------------------------");*/
      const { object } = await generateObject({
        model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
        schema: visionResultSchema,
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
      //debug 2 resultand objkect
      /* console.log("Debug 2 resultand objkect------------------");
      console.log("object", object);
      console.log("---------------------------------------");*/
      if (object.confirmed && activeTopics.has(object.id_topic)) {
        const matchedTopic = TOPICS.find((topic) => topic.id === object.id_topic);
        const threshold = CONFIDENCE_THRESHOLD[matchedTopic!.type];

        // guardar si es mejor que el candidato actual
        const existing = bestRankedByTopics.get(object.id_topic);
        if (!existing || object.id_topic_confidence > existing.id_topic_confidence) {
          bestRankedByTopics.set(object.id_topic, object);
        }
        // cerrar topic solo si supera threshold

        if (object.id_topic_confidence >= threshold) {
          activeTopics.delete(object.id_topic);
        }
        //debug 2 resultand objkect
        /*console.log("Debug 3 ranket topic ------------------");
        console.log("ranket topic", bestRankedByTopics.get(object.id_topic));
        console.log("---------------------------------------");*/
      }
    } catch (error) {
      console.error(`Vision failed for image ${image.id}:`, error);
      // sin reintentos — si falla ese objeto se descarta
    }
  }

  return Array.from(bestRankedByTopics.values());
}
