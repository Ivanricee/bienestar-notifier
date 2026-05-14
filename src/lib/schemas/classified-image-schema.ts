import { z } from "zod/v3";
// ------------------------------------------------
// SCHEMA ZOD
// ------------------------------------------------
const classifiedImageSchema = z.object({
  id: z.string(),
  onclick: z.string(),
  thumbnail_url: z.string(),
  id_topic: z.string(),
});

export const responseSchema = z.object({
  results: z.array(classifiedImageSchema),
});
