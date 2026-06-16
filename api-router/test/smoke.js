import { loadTiers } from "../src/router/tiers.js"
import { loadCentroids } from "../src/router/semantic.js"
import { gate } from "../src/router/gate.js"
import { route } from "../src/router/index.js"

// Smoke test: [A] gate/asse B deterministico (no rete),
//             [B] route() completo che stampa il tier scelto (richiede embed).
let failures = 0

function check(name, cond) {
  const ok = (!!cond)
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`)
  if (!ok) {
    failures++
  }
}

function names(tiers) {
  return (tiers.map((t) => (t.name)).sort().join(","))
}

const tiers = loadTiers()

// --- [A] GATE / asse B — deterministico, nessuna rete ---
console.log("\n[A] Gate / asse B (deterministico)")

// 1. testo corto → tutti i tier fattibili
{
  const msgs = [{ role: "user", content: "che ore sono" }]
  const { feasible } = gate(msgs, tiers)
  check("testo corto → tutti i tier", (names(feasible) === "tier-0,tier-1,tier-2"))
}

// 2. payload enorme → tier-0 (ctx 8192) escluso
{
  const big = ("parola ".repeat(9000))
  const { feasible, tokens } = gate([{ role: "user", content: big }], tiers)
  check(`payload enorme (${tokens} tok) → niente tier-0`, (!names(feasible).includes("tier-0")))
}

// 3. allegato immagine → solo tier-2 (unico con modalità image)
{
  const msgs = [{
    role: "user",
    content: [
      { type: "text", text: "descrivi questa immagine" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }
    ]
  }]
  const { feasible } = gate(msgs, tiers)
  check("immagine → solo tier-2", (names(feasible) === "tier-2"))
}

// --- [B] route() completo / asse A — richiede llama-embed + centroidi ---
console.log("\n[B] Route completo / asse A (richiede llama-embed + centroids)")

const centroids = loadCentroids()
if (!centroids) {
  console.log("  SKIP  centroids.json assente (lancia build-centroids)")
} else {
  const examples = [
    "che ore sono",
    "traduci buongiorno in tedesco",
    "refactora questa funzione e aggiungi i test",
    "progetta un'architettura a microservizi per ingestione real-time"
  ]
  for (const content of examples) {
    try {
      const chosen = await route({ messages: [{ role: "user", content }] }, { tiers, centroids })
      console.log(`  → [${chosen.name}]  "${content}"`)
    } catch (err) {
      console.log(`  ERR   embed non raggiungibile: ${err.message}`)
      break
    }
  }
}

console.log(`\n${failures === 0 ? "OK" : ("FALLITI: " + failures)}`)
process.exit(failures === 0 ? 0 : 1)
