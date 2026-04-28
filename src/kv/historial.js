export async function getHistorial(tema_id, env) {
  try {
    const data = await env.BIENESTAR_KV.get(`historial:${tema_id}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error al obtener historial de ${tema_id}:`, error);
    return null;
  }
}

export async function saveHistorial(tema_id, full_image_url, env) {
  try {
    const registro = {
      url: full_image_url,
      timestamp: Date.now(),
    };
    await env.BIENESTAR_KV.put(`historial:${tema_id}`, JSON.stringify(registro));
  } catch (error) {
    console.error(`Error al guardar historial de ${tema_id}:`, error);
    throw error;
  }
}
