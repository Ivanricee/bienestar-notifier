// ------------------------------------------------
// PROMPT

import { TOPICS } from "../../storage/data.ts";
import { ScrapeImagesType } from "../scraper.ts";

// ------------------------------------------------
export function classifiedImagesPrompt(scrapedImages: ScrapeImagesType[]): string {
  const keysToRemove = ["prompt_extraction", "template_msg"];
  const topicsJson = JSON.stringify(
    TOPICS,
    (key, value) => (keysToRemove.includes(key) ? undefined : value),
    2
  );
  const imagesJson = JSON.stringify(scrapedImages, null, 2);
  const prompt = `
  You are a URL classifier. Your task is to find semantic relationships between article URLs and topics of interest, using semantic understanding of Spanish — not just exact word matching.

  ## TOPICS OF INTEREST (JSON 1)
  ${topicsJson}

  Each topic has either:
  - type "exact": has keywords_required (mandatory semantic match) and keywords_context (support only)
  - type "semantic": has description (conceptual guide) and keywords_hint (orientative)

  ## SCRAPED IMAGES TO CLASSIFY (JSON 2)
  ${imagesJson}

  Each object has:
  - "id": unique identifier — keep exactly as received
  - "onclick": the URL to analyze — always a URL, may point to an article, image, or internal system
  - "thumbnail_url": secondary support — use only if onclick lacks readable words

  ## URL ANALYSIS RULES

  **How to extract meaning from a URL:**
  - Analyze "onclick" as the primary source
  - Decompose slugs into words: "UBICA_TU_PAGO" → "ubica tu pago", "calendariodepago" → "calendario de pago"
  - Known acronyms like "IMSS", "INAPAM" are valid — look for them directly in keywords_required or keywords_hint of each topic
  - Unknown acronyms not present in any topic keywords → ignore them
  - URLs are in Spanish — apply full semantic understanding including synonyms and related terms

  **When onclick has no readable words:**
  - If onclick contains only numbers, IDs, file names, or unknown characters → use thumbnail_url as the analysis source
  - If thumbnail_url also lacks readable words → include the object with id_topic as empty string ""

  **When onclick has readable words:**
  - Use those words to evaluate against topics semantically
  - thumbnail_url can reinforce the decision but cannot override onclick

  ## CLASSIFICATION RULES BY TYPE

  **For topics of type "exact":**
  - MANDATORY: at least ONE word from keywords_required must match — either literally OR through a clear Spanish synonym or semantically equivalent term
  - Synonym examples:
    - "pago" ≈ "deposito" ≈ "cobro" ≈ "transferencia" ≈ "abono"
    - "calendario" ≈ "agenda" ≈ "fechas" ≈ "programacion" ≈ "cronograma"
    - "registro" ≈ "afiliacion" ≈ "inscripcion" ≈ "alta"
  - VALID: "UBICA_TU_PAGO" → "pago" literal match ✓
  - VALID: "calendario-depositos-2026" → "depositos" is synonym of "pago" ✓
  - VALID: "fechas-de-cobro-pension" → "cobro" is synonym of "pago", "fechas" supports "calendario" ✓
  - INVALID: "ubicatubancodelbienestar" → "banco" has no synonym in keywords_required ✗
  - INVALID: "CINAPAM" → unknown acronym, not in keywords_required or synonyms ✗
  - keywords_context can support a synonym match but never produce a match alone
  - No keywords_required semantic match found → DISCARD the object

  **For topics of type "semantic":**
  - Use "description" to evaluate if the URL conceptually fits the topic
  - Apply semantic reasoning — the URL does not need to contain exact keywords_hint words
  - A conceptual or thematic relationship is sufficient to match
  - Clear conceptual match → include with matched topic id
  - If in doubt → DISCARD the object

  ## RESPONSE RULES

  - DISCARD completely if onclick contains clear readable words with no semantic relationship to any topic
  - INCLUDE with id_topic "" if onclick has no readable words — vision will validate in the next step
  - INCLUDE with matched topic id if onclick semantically matches keywords_required or description
  - Each object may match at most ONE topic — the most specific one
  - It is ALWAYS preferable to discard or use id_topic "" than to assign an incorrect topic
  - NEVER force a relationship that does not clearly exist semantically
  - Keep original values of id, onclick and thumbnail_url exactly as received

  ## RESPONSE FORMAT
  Respond ONLY with a JSON object. No explanations, no markdown, no text outside the JSON.

  If matches or vision candidates found:
  {
    "results": [
      {
        "id": "original object id",
        "onclick": "original url",
        "thumbnail_url": "original url",
        "id_topic": "matched topic id or empty string if no readable words"
      }
    ]
  }

  If nothing matches and nothing passes to vision:
  {
    "results": []
  }
  `;
  console.log("------------------------------------------------------");
  console.log("prompt: ", prompt);
  console.log("------------------------------------------------------");
  return prompt;
}
