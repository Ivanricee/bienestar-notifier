// ------------------------------------------------
// SCHEMA

import z from "zod/v3";

// ------------------------------------------------
export const visionResultSchema = z.object({
  id: z.string(),
  onclick: z.string(),
  thumbnail_url: z.string(),
  id_topic: z.string(),
  id_topic_confidence: z.number().min(0).max(1),
  confirmed: z.boolean(),
  extracted_data: z.any(),
  template_msg: z.string(),
});
export type VisionResult = z.infer<typeof visionResultSchema>;
