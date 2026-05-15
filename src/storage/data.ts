// ------------------------------------------------
// TYPES
// ------------------------------------------------
export interface ExactTopic {
  id: string;
  type: "exact";
  keywords_required: string[];
  keywords_context: string[];
  prompt_extraction: string;
  prompt_template: string;
  template_msg: string;
}

export interface SemanticTopic {
  id: string;
  type: "semantic";
  description: string;
  keywords_hint: string[];
  prompt_extraction: string;
  prompt_template: string;
  template_msg: string;
}

export type Topic = ExactTopic | SemanticTopic;

// ------------------------------------------------
// TOPICS
// ------------------------------------------------
export const TOPICS: Topic[] = [
  {
    id: "calendario_pension",
    type: "exact",
    keywords_required: ["calendario", "pago", "bimestre", "deposito"],
    keywords_context: [
      "fecha",
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
      "lunes",
      "martes",
      "miercoles",
      "jueves",
      "viernes",
      "abcd",
      "letras",
      "orden alfabetico",
    ],
    prompt_extraction: `
      Extract all payment dates and their corresponding letter ranges
      from the payment calendar visible in the image.
      Structure the result as:
      {
        letra: string,  // letter or range, e.g: "D-F"
        dia: string,    // payment day, e.g: "viernes"
        fecha: string,  // full date, e.g: "6 de marzo"
      }[]
    `,
    prompt_template: `
      Using extracted_data, find the payment date or dates corresponding
      to the first letter of the destinatario's first_surname.
      Generate a short informal greeting in Spanish, casual, maximum 1 sentence, no formalities.
      Structure the result as:
      {
        saludo: string,  // informal greeting generated in Spanish
        dia: string[],     // payment day or days
        fecha: string[],   // full date or dates
      }
    `,
    template_msg: "{saludo} Tu pago del bimestre cae el {dia} {fecha} 💸",
  },
  {
    id: "imss_gratuito",
    type: "semantic",
    description:
      "Anuncio de registro o acceso gratuito al seguro social IMSS para cualquier tipo de persona sin importar si tiene empleo formal",
    keywords_hint: ["imss", "seguro", "registro", "afiliacion", "gratuito"],
    prompt_extraction: `
      Extract the most relevant information about the free IMSS registration visible in the image.
      Structure the result as:
      {
        descripcion: string,   // brief summary of what the image announces
        fechas: string[],      // mentioned dates, empty array if none
        requisitos: string[],  // mentioned requirements, empty array if none
      }
    `,
    prompt_template: `
      Using extracted_data, extract the most relevant information about the IMSS registration.
      Generate a short informal greeting in Spanish, casual, maximum 1 sentence, no formalities.
      Structure the result as:
      {
        saludo: string,        // informal greeting generated in Spanish
        descripcion: string,   // brief summary
        fechas: string[],      // mentioned dates, empty array if none
        requisitos: string[],  // mentioned requirements, empty array if none
      }
    `,
    template_msg: "{saludo} {descripcion} 📋 Fechas: {fechas}. Requisitos: {requisitos}",
  },
];

export interface Destinatario {
  name: string;
  first_surname: string;
  chat_id: string;
  subscribed_topics: string[];
}
export const DESTINATARIOS: Destinatario[] = (() => {
  try {
    const envData = process.env.DESTINATARIOS;
    if (!envData) {
      console.warn("DESTINATARIOS not found in process.env, using empty array");
      return [];
    }
    return JSON.parse(envData);
  } catch (error) {
    console.error("Error parsing DESTINATARIOS from process.env:", error);
    return [];
  }
})();
export const ACTIVE_TOPICS = new Set(DESTINATARIOS.flatMap((d) => d.subscribed_topics));
