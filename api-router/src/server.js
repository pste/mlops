import Fastify from "fastify"
import { Readable } from "node:stream"
import { loadTiers } from "./router/tiers.js"
import { loadCentroids } from "./router/semantic.js"
import { route } from "./router/index.js"
import { forward } from "./upstream.js"

const PORT = (process.env.PORT || 8000)
const HOST = (process.env.HOST || "0.0.0.0")

const fastify = Fastify({ logger: true })

// Caricati una volta all'avvio.
const tiers = loadTiers()
const centroids = loadCentroids()
if (!centroids) {
  fastify.log.warn("centroids.json assente: asse A disabilitato, lancia build-centroids")
}

fastify.get("/health", async () => ({ status: "ok" }))

fastify.post("/v1/chat/completions", async (request, reply) => {
  const body = request.body

  // Lo "stage" traccia a che punto siamo: in caso di errore lo riportiamo
  // al client cosi' si capisce subito QUALE hop ha fallito.
  let stage = "route"

  try {
    // ① decide il tier (assi A/B)
    const chosen = await route(body, { tiers, centroids })
    request.log.info({ tier: chosen.name, model: chosen.model }, "tier scelto")

    // ② inoltra a LiteLLM col model giusto
    stage = "forward"
    const upstream = await forward({ ...body, model: chosen.model })

    // Se LiteLLM risponde con errore, propaga status e corpo leggibile
    // (niente streaming di un body d'errore: lo restituiamo per intero).
    if (!upstream.ok) {
      const text = await upstream.text()
      request.log.error({ status: upstream.status, body: text }, "errore da LiteLLM")
      return reply.code(upstream.status).type("application/json").send(text)
    }

    // ③ passthrough del body (anche streaming SSE) cosi' com'e'
    stage = "stream"
    if (!upstream.body) {
      throw new Error("risposta upstream senza body")
    }
    reply.code(upstream.status)
    upstream.headers.forEach((value, key) => {
      if ((key !== "content-encoding") && (key !== "transfer-encoding")) {
        reply.header(key, value)
      }
    })
    return reply.send(Readable.fromWeb(upstream.body))
  } catch (err) {
    // Eccezione (embed irraggiungibile, LiteLLM down, body nullo, ...):
    // 502 con JSON {error, stage} invece di un 500 muto.
    request.log.error({ err, stage }, "richiesta fallita")
    return reply.code(502).type("application/json").send({ error: err.message, stage })
  }
})

try {
  await fastify.listen({ port: Number(PORT), host: HOST })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
