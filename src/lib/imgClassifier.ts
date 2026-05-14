import { createHash } from "crypto";
import { redis } from "../lib/redis.ts";
import { reasoningClassifyImages } from "./reasoning.ts";
import { ScrapeImagesType } from "./scraper.ts";

const HISTORY_KEY = "notifier:bienestar";

const scrapedImages = [
  {
    id: "de9efd34-93e8-40ec-9d45-0049e764e9ee",
    onclick: "https://www.gob.mx/cms/uploads/image/file/1071840/IMG-20260503-WA0008.jpg",
    thumbnail_url: "/cms/uploads/identity/image/51298/IMG-20260503-WA0005.jpg",
  },
  {
    id: "8f9ccd3d-3339-4ffb-82f2-23475afd9649",
    onclick: "http://200.188.126.15:8082/UBICA_TU_PAGO.bienestar/index/",
    thumbnail_url: "/cms/uploads/identity/image/51299/IMG-20260503-WA0003.jpg",
  },
  {
    id: "c01cc4e9-906c-44b4-837d-c9067c5e146c",
    onclick: "http://200.188.126.49/CINAPAM.bienestar/",
    thumbnail_url: "/cms/uploads/identity/image/47686/BannerTarjetaINAPAM.jpeg",
  },
  {
    id: "3be8eead-0907-4697-a8fa-9a52d27624ea",
    onclick: "http://ubicatubancodelbienestar.bienestar.gob.mx/",
    thumbnail_url: "/cms/uploads/identity/image/38431/_2BANCO_DEL_IENESTAR_BANNER_WEB-02.jpg",
  },
  {
    id: "4dffea41-631d-4b33-a434-43ff449d3e80",
    onclick: "https://www.gob.mx/bienestar/documentos/plan-nacional-de-desarrollo-2025-2030-388018",
    thumbnail_url: "/cms/uploads/identity/image/46884/BannerPND25-30gn.jpeg",
  },
];
/*[
  {
    id: "695b98ff-77c8-400c-97f1-d408ff0cb7c2",
    onclick: "https://ubicatumodulo.bienestar.gob.mx/",
    thumbnail_url:
      "https://res.cloudinary.com/ivanrice-c/image/fetch/c_limit,w_1120,h_1120,f_auto,q_auto/https://www.gob.mx/cms/uploads/identity/image/51254/IMG-20260426-WA0003.jpg/",
  },
  {
    id: "6b9eb46f-9be4-4a18-a28c-56e817fc90b4",
    onclick: "http://200.188.126.15:8082/UBICA_TU_MODULO.bienestar/",
    thumbnail_url:
      "https://res.cloudinary.com/ivanrice-c/image/fetch/c_limit,w_1120,h_1120,f_auto,q_auto/https://www.gob.mx/cms/uploads/identity/image/51139/IMG-20260407-WA0012.jpg/",
  },
  {
    id: "1404d7e1-2c9d-4e6e-9132-1a5edb2e21f7",
    onclick: "http://200.188.126.49/CINAPAM.bienestar/",
    thumbnail_url:
      "https://res.cloudinary.com/ivanrice-c/image/fetch/c_limit,w_1120,h_1120,f_auto,q_auto/https://www.gob.mx/cms/uploads/identity/image/47686/BannerTarjetaINAPAM.jpeg/",
  },
  {
    id: "87d4afd2-9b3d-46a6-81b8-d0f050bef2ec",
    onclick: "http://ubicatubancodelbienestar.bienestar.gob.mx/",
    thumbnail_url:
      "https://res.cloudinary.com/ivanrice-c/image/fetch/c_limit,w_1120,h_1120,f_auto,q_auto/https://www.gob.mx/cms/uploads/identity/image/38431/_2BANCO_DEL_IENESTAR_BANNER_WEB-02.jpg/",
  },
  {
    id: "bad095be-b123-4770-bf06-a6ed1a411981",
    onclick: "https://www.gob.mx/bienestar/documentos/plan-nacional-de-desarrollo-2025-2030-388018",
    thumbnail_url:
      "https://res.cloudinary.com/ivanrice-c/image/fetch/c_limit,w_1120,h_1120,f_auto,q_auto/https://www.gob.mx/cms/uploads/identity/image/46884/BannerPND25-30gn.jpeg/",
  },
];*/
function makeId(onclick: string, thumbnail_url: string): string {
  return createHash("md5").update(`${onclick}::${thumbnail_url}`).digest("hex").slice(0, 16);
}
/**
 * based on onclick and thumbnail_url values compared to interest topics
 * call an LLm to classify if hte information context is of interest.
 * @returns
 */
export async function getClassifiedImages(/*scrapedImages: ScrapeImagesType[]*/) {
  //filter existing images
  const filteredImageTopics = await filterStoredImages(scrapedImages);
  //console.log("filteredImageTopics: ", filteredImageTopics);
  //no hay informacion nueva que revisar, dormir 1 semana
  if (filteredImageTopics.length === 0) return null;
  //filter interest topics
  const filteredInterestTopics = filterInterestTopics(filteredImageTopics);
  return filteredInterestTopics;
}

async function filterStoredImages(scrapedImages: ScrapeImagesType[]): Promise<ScrapeImagesType[]> {
  const pipeline = redis.pipeline();
  scrapedImages.forEach((img) => {
    const id = makeId(img.onclick, img.thumbnail_url);
    pipeline.sismember(HISTORY_KEY, id);
  });
  const results = await pipeline.exec<number[]>();
  console.log("------------------------------------------------------");
  console.log("results: ", results);
  console.log("------------------------------------------------------");
  return scrapedImages.filter((_, index) => results[index] === 0);
}

/**
 * check agains LLM if current scraped image match the stored interest topics
 * @param ImgeTopics
 */
export interface classifiedImages extends ScrapeImagesType {
  id_topic: string;
}
async function filterInterestTopics(ImageTopics: ScrapeImagesType[]): Promise<classifiedImages[]> {
  const { results, error } = await reasoningClassifyImages(ImageTopics);

  if (error) {
    console.error("Error classifying images:", error);
    return [];
  }

  return results;
}

// Call after telegram actions.
export async function saveNewItems(items: classifiedImages[]): Promise<void> {
  if (items.length === 0) return;

  const pipeline = redis.pipeline();

  for (const item of items) {
    const id = makeId(item.onclick, item.thumbnail_url);
    pipeline.sadd(HISTORY_KEY, id);
  }

  await pipeline.exec();
}
