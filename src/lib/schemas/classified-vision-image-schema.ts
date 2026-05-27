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
  extracted_data: z.union([
    z.record(z.any()), // objeto con cualquier keys — cuando confirmed: true
    z.array(z.any()), // array — cuando el LLM extrae tabla como array
    z.null(), // null — cuando confirmed: false
  ]),
  template_msg: z.string(),
});
//export type VisionResult = z.infer<typeof visionResultSchema>;
export type VisionResult = {
  id: string;
  onclick: string;
  thumbnail_url: string;
  id_topic: string;
  id_topic_confidence: number;
  confirmed: boolean;
  extracted_data: Record<string, any> | any[] | {};
  template_msg: string;
};
