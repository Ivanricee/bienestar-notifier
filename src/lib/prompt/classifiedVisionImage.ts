// ------------------------------------------------
// PROMPT

import { Topic } from "../../storage/data.js";
import { classifiedImages } from "../imgClassifier.js";

// ------------------------------------------------
export function visionPrompt(image: classifiedImages, topics: Topic[]): string {
  const topicsFiltered = topics.map(({ prompt_template, template_msg, ...rest }) => rest);
  const topicsJson = JSON.stringify(topicsFiltered, null, 2);
  const imageJson = JSON.stringify(image, null, 2);

  return `
You are a government document image analyzer specialized in Mexican social welfare programs.

## TOPICS OF INTEREST (JSON 1)
${topicsJson}

## IMAGE METADATA (JSON 2)
${imageJson}

## YOUR TASK
Analyze the image you are receiving.

### STEP 1 — TOPIC CONFIRMATION

**If id_topic in JSON 2 is NOT empty:**
- Go directly to that topic in JSON 1
- Validate the image content against that topic using:
  - If topic type is "exact":
    - keywords_required: at least ONE must be visible or clearly inferable from image text, labels, dates, or visual elements — literal or synonym match in Spanish
    - keywords_context: use as supporting evidence only, never sufficient alone
    - Synonym examples:
      - "pago" ≈ "deposito" ≈ "cobro" ≈ "transferencia" ≈ "abono"
      - "calendario" ≈ "agenda" ≈ "fechas" ≈ "programacion" ≈ "cronograma"
      - "registro" ≈ "afiliacion" ≈ "inscripcion" ≈ "alta"
  - If topic type is "semantic":
    - Use description to evaluate if image content conceptually fits the topic
    - keywords_hint are orientative, not mandatory
    - A conceptual or thematic match is sufficient
  - prompt_extraction: use to understand what specific content this topic should show
- If image shows clear specific evidence → confirmed: true, keep id_topic
- Generic government or bienestar banner without topic-specific content → confirmed: false, id_topic: ""
- Set id_topic_confidence: your confidence level from 0.0 to 1.0

**If id_topic in JSON 2 IS empty:**
- Read ALL topics in JSON 1
- Analyze visible content of the image: text, labels, dates, program names, logos, visual elements
- For each topic evaluate:
  - If type "exact": at least ONE keyword_required visible or inferable as synonym
  - If type "semantic": image conceptually fits the description
  - keywords_context and keywords_hint as supporting evidence only
- Synonym examples:
  - "pago" ≈ "deposito" ≈ "cobro" ≈ "transferencia" ≈ "abono"
  - "calendario" ≈ "agenda" ≈ "fechas" ≈ "programacion" ≈ "cronograma"
  - "registro" ≈ "afiliacion" ≈ "inscripcion" ≈ "alta"
- If clear match found → confirmed: true, assign id_topic, set id_topic_confidence
- If no match or unclear → confirmed: false, id_topic: "", id_topic_confidence: 0.0
- It is ALWAYS preferable to set confirmed: false than to force an incorrect match

Calibrate id_topic_confidence as follows:
- 1.0: topic-specific content is explicitly and completely visible
- 0.8-0.9: clear evidence, minor details missing
- 0.6-0.7: reasonable match but content is vague or partial
- 0.4-0.5: weak relation, mostly inferred
- 0.0-0.3: no clear relation

### STEP 2 — DATA EXTRACTION
Only if confirmed is true:
- Read prompt_extraction of the matched topic in JSON 1
- Extract only what is explicitly visible in the image following those instructions precisely
- Do not invent or assume anything not clearly visible
- If something described in prompt_extraction is not visible, omit it from extracted_data
- extracted_data can be an object or an array depending on what prompt_extraction instructs

If confirmed is false → extracted_data must be {} (empty object, never null)

## RESPONSE FORMAT
Respond ONLY with raw JSON. No markdown, no code blocks, no backticks, no explanations, no text outside the JSON.

{
  "id": "original id from JSON 2",
  "onclick": "original value from JSON 2",
  "thumbnail_url": "original value from JSON 2",
  "id_topic": "confirmed topic id or empty string if no match",
  "id_topic_confidence": 0.0 to 1.0,
  "confirmed": true or false,
  "extracted_data": extracted object or array following prompt_extraction instructions, or {} if confirmed is false,
  "template_msg": ""
}
`;
}
