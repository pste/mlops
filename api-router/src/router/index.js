import { gate } from "./gate.js"
import { semantic } from "./semantic.js"

// Sceglie il tier finale = il piu' economico FATTIBILE con order >= preferito.
// E' il max(A,B): il gate puo' aver gia' escluso il tier preferito (payload
// troppo grosso), quindi si sale al primo fattibile sopra la soglia.
function decide(feasible, preferredOrder) {
  const sorted = [...feasible].sort((a, b) => (a.order - b.order))
  const targetOrder = Math.max(preferredOrder, sorted[0].order)
  const chosen = sorted.find((tier) => (tier.order >= targetOrder))
  return (chosen || sorted[sorted.length - 1])
}

// Orchestra la decisione: ① gate (asse B) → ② semantic (asse A) → ③ max(A,B).
// Ritorna l'oggetto tier scelto (il suo .model va passato a LiteLLM).
export async function route(body, { tiers, centroids }) {
  const messages = (body.messages || [])

  // ① ASSE B
  const { feasible, text } = gate(messages, tiers)
  if (feasible.length === 0) {
    // Nessun tier regge il payload: ripiego sul piu' capiente.
    return (tiers[tiers.length - 1])
  }

  // ② ASSE A (solo se i centroidi sono pronti; altrimenti tier fattibile minimo)
  let preferred = feasible[0]
  if (centroids) {
    const { tier: name } = await semantic(text, centroids)
    preferred = (tiers.find((t) => (t.name === name)) || feasible[0])
  }

  // ③ Decisione
  return (decide(feasible, preferred.order))
}
