import { getEncoding } from "js-tiktoken"

// Tokenizer in-process per il GATE (asse B). E' una soglia grezza: il conteggio
// con cl100k_base e' un'approssimazione per i modelli llama/qwen, ma per escludere
// i tier per context-window va piu' che bene. Niente container dedicato.
const enc = getEncoding("cl100k_base")

export function countTokens(text) {
  return (enc.encode(text).length)
}
