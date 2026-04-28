import { getTemaById } from "./kv/temas.js";
import { getDestinatarios } from "./kv/destinatarios.js";

export async function matchDestinatarios(extraccion, env) {
  const { datos, tema_id } = extraccion;

  try {
    const tema = await getTemaById(tema_id, env);
    if (!tema) {
      console.error(`Tema ${tema_id} no encontrado para matching`);
      return [];
    }

    const destinatarios = await getDestinatarios(env);
    if (destinatarios.length === 0) {
      console.log("No hay destinatarios configurados.");
      return [];
    }

    if (tema.match_por_inicial) {
      return matchPorInicial(datos, tema_id, destinatarios);
    } else {
      return matchGeneral(datos, tema_id, destinatarios);
    }
  } catch (error) {
    console.error("Error en matching:", error);
    return [];
  }
}

function matchPorInicial(datos, tema_id, destinatarios) {
  // Los datos extraídos contienen array de {fecha, actividad, inicial_apellido}
  const entradas = Array.isArray(datos) ? datos : datos.entradas || datos.registros || [];
  const matches = new Map();

  for (const entrada of entradas) {
    if (!entrada.inicial_apellido) continue;

    const inicialDato = entrada.inicial_apellido.toUpperCase();

    for (const dest of destinatarios) {
      if (!dest.temas_suscritos.includes(tema_id)) continue;

      const inicialDest = (dest.inicial_apellido || "").toUpperCase();
      if (inicialDato !== inicialDest) continue;

      const key = dest.chat_id;
      if (!matches.has(key)) {
        matches.set(key, {
          destinatario: dest,
          fechas_asignadas: [],
        });
      }
      matches.get(key).fechas_asignadas.push({
        fecha: entrada.fecha,
        actividad: entrada.actividad,
      });
    }
  }

  const resultado = Array.from(matches.values());
  console.log(`Match por inicial: ${resultado.length} destinatarios encontrados`);
  return resultado;
}

function matchGeneral(datos, tema_id, destinatarios) {
  const resultado = destinatarios
    .filter((d) => d.temas_suscritos.includes(tema_id))
    .map((d) => ({
      destinatario: d,
      datos_completos: datos,
    }));

  console.log(`Match general: ${resultado.length} destinatarios encontrados`);
  return resultado;
}
