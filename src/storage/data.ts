// ------------------------------------------------
// TYPES
// ------------------------------------------------
interface ExactTopic {
  id: string;
  type: "exact";
  keywords_required: string[];
  keywords_context: string[];
  prompt_extraction: string;
  template_msg: string;
}

interface SemanticTopic {
  id: string;
  type: "semantic";
  prompt_extraction: string;
  description: string;
  keywords_hint: string[];
  template_msg: string;
}

type Topic = ExactTopic | SemanticTopic;

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
    prompt_extraction: "Extrae las fechas y actividades...",
    template_msg: "Hola {nombre}, tu actividad: {fecha} - {actividad}",
  },
  {
    id: "imss_gratuito",
    type: "semantic",
    description:
      "Anuncio de registro o acceso gratuito al seguro social IMSS para cualquier tipo de persona sin importar si tiene empleo formal",
    keywords_hint: ["imss", "seguro", "registro", "afiliacion", "gratuito"],
    prompt_extraction: "Extrae las fechas y actividades...",
    template_msg: "Hola {nombre}, tu actividad: {fecha} - {actividad}",
  },
];

export const DESTINATARIOS = [
  {
    name: "Juan Pérez",
    chat_id: "123456789",
    subscribed_topics: ["calendario_pension"],
  },
];
