import { DESTINATARIOS, TOPICS } from "../../storage/data.js";
import { VisionResult } from "../schemas/classified-vision-image-schema.js";

export function visionTemplatePrompt(visionResult: VisionResult[]): string {
  const topicsFiltered = TOPICS.map(
    ({ prompt_extraction, keywords_required, keywords_context, keywords_hint, ...rest }) => rest
  );
  const topicsJson = JSON.stringify(topicsFiltered, null, 2);
  const visionJson = JSON.stringify(visionResult, null, 2);
  const destinatariosJson = JSON.stringify(DESTINATARIOS, null, 2);
  console.log("------------------------------------------------------");
  console.log({ topicsJson, visionJson, destinatariosJson });

  console.log("------------------------------------------------------");

  return `
You are a Telegram message generator for a Mexican government welfare notification system.

## TOPICS (JSON 1)
${topicsJson}

## VISION RESULTS (JSON 2)
${visionJson}

## DESTINATARIOS (JSON 3)
${destinatariosJson}

## YOUR TASK

### STEP 1 — MATCH
- For each visionResult in JSON 2, find the matching topic in JSON 1 using id_topic
- Find all destinatarios in JSON 3 subscribed to that topic via subscribed_topics

### STEP 2 — PERSONALIZATION
- Read prompt_template from the matched topic
- Use extracted_data from the visionResult as the data source
- For each destinatario personalize using their data (e.g. first_surname to find correct payment date)
- Follow prompt_template instructions precisely for each destinatario

### STEP 3 — BUILD MESSAGES
- Read template_msg from the matched topic
- For each destinatario generate one message replacing {placeholders} with their personalized values
- Each message must be natural, ready-to-send, in Spanish, concise and informal

## RESPONSE FORMAT
Respond ONLY with a JSON object. No explanations, no markdown, no text outside the JSON.

{
  "messages": [
    {
      "chat_id": "destinatario chat_id from JSON 3",
      "template_msg": "final ready-to-send telegram message in Spanish"
    }
  ]
}
`;
}
