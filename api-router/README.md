# api-router

Router intelligente davanti a LiteLLM (v1, fuori da kube).
Espone `/v1/chat/completions` OpenAI-compatibile, decide il tier e inoltra.

## Flusso
1. **GATE** — `tokenCount` vs context-window/modalita' → tier fattibili.
2. **SEMANTIC** — embedding dell'istruzione + cosine vs centroidi → tier preferito.
3. **Decisione** — il piu' economico fattibile con `order >= preferito` (`max(GATE, SEMANTIC)`).
4. **Forward** — a LiteLLM con `model = tier` (stream passthrough).

## Variabili d'ambiente
| var | default | descrizione |
|-----|---------|-------------|
| `PORT` / `HOST` | `8000` / `0.0.0.0` | bind del server |
| `LITELLM_URL` | `http://litellm:4000` | gateway a valle |
| `LITELLM_KEY` | (vuota) | bearer per LiteLLM, se serve |
| `EMBED_URL` | `http://llama-embed:8080` | container embedding |
| `EMBED_MODEL` | `embed` | nome modello embedding |

## Avvio
Su host gli script raggiungono `llama-embed` via la porta pubblicata dal compose
(`:8080`), quindi serve l'override `EMBED_URL` (il default punta al DNS interno):
```
npm install
EMBED_URL=http://localhost:8080 npm run build-centroids   # offline: seed → data/centroids.json
npm run dev                                                # server con --watch
```
Senza `centroids.json` il server parte lo stesso: la fase SEMANTIC si disabilita e
instrada al tier fattibile piu' economico.

## Config
- `config/tiers.json` — capacita' dei tier (context-window, modalita', ordine).
- `config/routes.seed.json` — utterance sintetiche per tier (seed della fase SEMANTIC).

## Test
```
npm run smoke                                   # [A] gate deterministico (no rete)
EMBED_URL=http://localhost:8080 npm run smoke   # [A] + [B] route completo (serve llama-embed)
```
La parte [B] stampa il tier scelto per alcune query d'esempio; va in SKIP se
`data/centroids.json` non e' ancora stato costruito.
