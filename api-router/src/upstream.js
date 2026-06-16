// Inoltro verso LiteLLM. Il router decide il tier e lo passa come "model";
// LiteLLM fa load-balancing intra-tier, fallback e accounting.
// Ritorna la Response grezza: il body (anche in streaming SSE) viene
// ri-emesso tale e quale dal server.
const LITELLM_URL = (process.env.LITELLM_URL || "http://litellm:4000")
const LITELLM_KEY = (process.env.LITELLM_KEY || "")

export async function forward(body) {
  const headers = { "content-type": "application/json" }
  if (LITELLM_KEY) {
    headers.authorization = `Bearer ${LITELLM_KEY}`
  }

  return (await fetch(`${LITELLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  }))
}
