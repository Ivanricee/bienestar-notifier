import z from "zod/v3";

export const visionTemplateSchema = z.object({
  messages: z.array(
    z.object({
      chat_id: z.string(),
      template_msg: z.string(),
    })
  ),
});
