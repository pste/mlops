import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { embed } from "../embeddings.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const centroidsPath = join(__dirname, "../../data/centroids.json")

// Carica i centroidi precalcolati da build-centroids.js.
// Se il file non c'e' ancora (primo boot) ritorna null: l'asse A si disabilita.
export function loadCentroids() {
  try {
    const raw = readFileSync(centroidsPath, "utf-8")
    return (JSON.parse(raw).centroids)
  } catch {
    return (null)
  }
}

function cosine(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] * b[i])
    na += (a[i] * a[i])
    nb += (b[i] * b[i])
  }
  return (dot / (Math.sqrt(na) * Math.sqrt(nb)))
}

// ASSE A: embedda l'istruzione e ritorna il nome del tier col centroide
// piu' vicino (cosine massimo).
export async function semantic(text, centroids) {
  const queryVec = await embed(text)
  let best = null
  let bestScore = -Infinity

  for (const [tierName, vec] of Object.entries(centroids)) {
    const score = cosine(queryVec, vec)
    if (score > bestScore) {
      bestScore = score
      best = tierName
    }
  }

  return { tier: best, score: bestScore }
}
