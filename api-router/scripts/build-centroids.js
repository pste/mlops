import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { embed } from "../src/embeddings.js"

// Step OFFLINE: legge le utterance del seed, le embedda una volta e calcola
// il centroide (media) per ogni tier. Da rilanciare quando cambi il seed.
const __dirname = dirname(fileURLToPath(import.meta.url))
const seedPath = join(__dirname, "../config/routes.seed.json")
const outPath = join(__dirname, "../data/centroids.json")

function average(vectors) {
  const dim = vectors[0].length
  const sum = new Array(dim).fill(0)
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i]
    }
  }
  return (sum.map((x) => (x / vectors.length)))
}

async function main() {
  const seed = JSON.parse(readFileSync(seedPath, "utf-8"))
  const centroids = {}

  for (const [tier, utterances] of Object.entries(seed)) {
    const vectors = []
    for (const text of utterances) {
      vectors.push(await embed(text))
    }
    centroids[tier] = average(vectors)
    console.log(`centroide ${tier}: da ${vectors.length} esempi`)
  }

  const dim = Object.values(centroids)[0].length
  writeFileSync(outPath, JSON.stringify({ dim, centroids }, null, 2))
  console.log(`scritto ${outPath} (dim=${dim})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
