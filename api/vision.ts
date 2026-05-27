import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeImagesWithVision } from "../src/lib/vision.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const classifiedImages = [
    {
      id: "fb6d990a-d371-42c9-acab-bbec41488ab6",
      onclick: "http://200.188.126.15:8082/ENTREGA_TARJETAS.bienestar/",
      thumbnail_url: "/cms/uploads/identity/image/51403/EntregaTarjetasPCD-May26.jpeg",
      id_topic: "",
    },
    {
      id: "83b31cac-2ca2-4bcf-a656-7bd57495995b",
      onclick: "https://www.gob.mx/cms/uploads/image/file/1071840/IMG-20260503-WA0008.jpg",
      thumbnail_url: "/cms/uploads/identity/image/51298/IMG-20260503-WA0005.jpg",
      id_topic: "",
    },
    {
      id: "c0280188-febe-419e-af62-95caef39e50c",
      onclick: "http://200.188.126.15:8082/UBICA_TU_PAGO.bienestar/index/",
      thumbnail_url: "/cms/uploads/identity/image/51299/IMG-20260503-WA0003.jpg",
      id_topic: "calendario_pension",
    },
  ];

  const visionResult = await analyzeImagesWithVision(classifiedImages);
  res.json(visionResult);
}
