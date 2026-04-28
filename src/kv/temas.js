export async function getTemas(env) {
  try {
    const data = await env.BIENESTAR_KV.get("config:temas");
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Error al obtener temas de KV:", error);
    return [];
  }
}

export async function saveTemas(temas, env) {
  try {
    await env.BIENESTAR_KV.put("config:temas", JSON.stringify(temas));
  } catch (error) {
    console.error("Error al guardar temas en KV:", error);
    throw error;
  }
}

export async function getTemaById(id, env) {
  const temas = await getTemas(env);
  return temas.find((t) => t.id === id) || null;
}

export async function addTema(tema, env) {
  const temas = await getTemas(env);
  temas.push(tema);
  await saveTemas(temas, env);
}

export async function updateTema(id, cambios, env) {
  const temas = await getTemas(env);
  const index = temas.findIndex((t) => t.id === id);
  if (index === -1) return false;
  temas[index] = { ...temas[index], ...cambios };
  await saveTemas(temas, env);
  return true;
}

export async function deleteTema(id, env) {
  const temas = await getTemas(env);
  const filtrados = temas.filter((t) => t.id !== id);
  if (filtrados.length === temas.length) return false;
  await saveTemas(filtrados, env);
  return true;
}
