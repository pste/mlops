import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const configPath = join(__dirname, "../../config/tiers.json")

// Carica i tier ordinati per "order" crescente (0 = piu' economico).
// "model" e' il nome del model-group che LiteLLM riconosce.
export function loadTiers() {
  const raw = readFileSync(configPath, "utf-8")
  const { tiers } = JSON.parse(raw)
  return (tiers.sort((a, b) => (a.order - b.order)))
}
