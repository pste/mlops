import { countTokens } from "../tokenizer.js"

// Estrae il testo e le modalita' richieste dai messaggi (formato OpenAI).
// content puo' essere stringa oppure array di parti (text / image_url).
function inspect(messages) {
  let text = ""
  const modalities = new Set(["text"])

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      text += (msg.content + "\n")
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          text += (part.text + "\n")
        } else if (part.type === "image_url") {
          modalities.add("image")
        }
      }
    }
  }

  return { text, modalities: [...modalities] }
}

// GATE (deterministico, calcolato per primo): ritorna i tier che reggono
// il payload per context-window e che supportano le modalita' richieste.
// Ritorna anche text e tokens, riusati a valle (DRY).
export function gate(messages, tiers) {
  const { text, modalities } = inspect(messages)
  const tokens = countTokens(text)

  const feasible = tiers.filter((tier) => {
    const fitsContext = (tokens <= tier.contextWindow)
    const fitsModality = modalities.every((m) => (tier.modalities.includes(m)))
    return (fitsContext && fitsModality)
  })

  return { feasible, text, tokens, modalities }
}
