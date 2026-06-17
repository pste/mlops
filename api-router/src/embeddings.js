// Client per il container embedding dedicato (llama-server --embedding),
// endpoint OpenAI-compatibile /v1/embeddings. Usato dalla fase SEMANTIC.
const EMBED_URL = (process.env.EMBED_URL || "http://llama-embed:8080")
const EMBED_MODEL = (process.env.EMBED_MODEL || "embed")

export async function embed(text) {
  const res = await fetch(`${EMBED_URL}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text })
  })

  if (!res.ok) {
    throw new Error(`embeddings: HTTP ${res.status}`)
  }

  const data = await res.json()
  return (data.data[0].embedding)
}
