import { z } from "zod";
// ------------------------------------------------
// SCHEMA ZOD
// ------------------------------------------------
const classifiedImageSchema = z.object({
  id: z.string(),
  onclick: z.string().url(),
  thumbnail_url: z.string().url(),
  raw_url: z.string(),
  id_topic: z.string(),
});

export const responseSchema = z.object({
  results: z.array(classifiedImageSchema),
});
