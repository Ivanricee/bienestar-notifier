/**
 * Script de inicialización de KV con datos de ejemplo.
 *
 * Uso:
 *   1. Copia .env.example a .env y llena las variables
 *   2. Ejecuta: node scripts/init-kv.js
 *
 * Requiere Node.js 18+ (por fetch nativo)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar variables de entorno desde .env
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env");
    const content = readFileSync(envPath, "utf-8");
    const vars = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      vars[key.trim()] = rest.join("=").trim();
    }
    return vars;
  } catch (error) {
    console.error("Error: No se encontró el archivo .env");
    console.error("Copia .env.example a .env y llena las variables.");
    process.exit(1);
  }
}

const env = loadEnv();
const CF_ACCOUNT_ID = env.CF_ACCOUNT_ID;
const CF_API_TOKEN = env.CF_API_TOKEN;
const KV_NAMESPACE_ID = env.KV_NAMESPACE_ID;

if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !KV_NAMESPACE_ID) {
  console.error("Error: CF_ACCOUNT_ID, CF_API_TOKEN y KV_NAMESPACE_ID son requeridos en .env");
  process.exit(1);
}

const KV_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}`;

async function putKV(key, value) {
  const url = `${KV_API_BASE}/values/${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "text/plain",
    },
    body: typeof value === "string" ? value : JSON.stringify(value),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error escribiendo ${key}: ${response.status} ${error}`);
  }

  console.log(`✅ ${key} guardado`);
}

// ─── DATOS DE EJEMPLO ────────────────────────────────────────

const temasEjemplo = [
  {
    id: "calendario_bienestar",
    palabras_clave_deteccion: [
      "calendario",
      "bienestar",
      "actividades",
      "programa",
    ],
    match_por_inicial: true,
    prompt_extraccion:
      "Extrae de esta imagen del calendario las fechas y actividades programadas. " +
      "Por cada entrada, identifica la fecha, la actividad y la inicial del apellido si aparece. " +
      "Responde SOLO en JSON válido con esta estructura: " +
      '[{"fecha": "string", "actividad": "string", "inicial_apellido": "string"}]',
    plantilla_mensaje:
      "Hola {nombre}, tienes una actividad programada:\n📅 Fecha: {fecha}\n📋 Actividad: {actividad}",
  },
];

const destinatariosEjemplo = [
  {
    nombre: "Juan Pérez",
    chat_id: "123456789",
    inicial_apellido: "P",
    temas_suscritos: ["calendario_bienestar"],
  },
];

// ─── EJECUCIÓN ───────────────────────────────────────────────

async function main() {
  console.log("Inicializando KV con datos de ejemplo...\n");

  try {
    await putKV("config:temas", JSON.stringify(temasEjemplo));
    await putKV("config:destinatarios", JSON.stringify(destinatariosEjemplo));

    console.log("\n🎉 Inicialización completada.");
    console.log("\nRecuerda actualizar los datos de ejemplo con tus datos reales");
    console.log("usando los comandos del bot de Telegram o editando el script.");
  } catch (error) {
    console.error("\n❌ Error durante la inicialización:", error.message);
    process.exit(1);
  }
}

main();
