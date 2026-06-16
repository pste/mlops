# mlops — Cluster ML multi-tier

Esercizio di costruzione di un **inference cluster** con routing intelligente:
una richiesta entra, viene classificata, e instradata al **tier più economico
capace di servirla**; il cloud fa da overflow. L'obiettivo a regime è usare
**KubeEdge** per agganciare nodi spot/edge effimeri.

Progetto didattico, sviluppato a stadi: **v1** gira in `docker-compose` fuori da
Kubernetes; **v2** introduce kube/KubeEdge, coda e shim.

---

## L'idea in una riga

> Non tutte le richieste meritano la GPU grossa. Classifica la complessità,
> manda il banale al modello leggero, tieni il modello forte per ciò che lo richiede.

```
            ┌──────────────┐
client ───▶ │  API/Router  │   decide il tier (assi A/B)
            └──────┬───────┘
                   ▼
            ┌──────────────┐
            │   LiteLLM    │   load-balancing, fallback, accounting
            └──┬───────┬───┘
       ┌───────┘       └────────┬─────────────┐
   ┌───▼────┐          ┌────────▼───┐    ┌─────▼─────┐
   │ tier-0 │          │  tier-1    │    │  tier-2   │
   │llama.cpp│         │ vLLM (GPU) │    │  cloud    │
   │  CPU   │          │  locale    │    │ (overflow)│
   └────────┘          └────────────┘    └───────────┘
```

---

## Componenti

| Componente   | Ruolo |
|--------------|-------|
| **API/Router** | L'hop intelligente. Riceve `/v1/chat/completions`, **decide il tier** e inoltra. Non serve modelli, non bilancia. (Node/Fastify — vedi `api-router/`) |
| **LiteLLM**    | Gateway a valle. Load-balancing intra-tier, **failover** cross-tier (fallbacks + context-window + retry/cooldown), accounting token/spend. NON fa semantic routing (non è nativo): l'intelligenza sta nel Router. |
| **llama-embed** | `llama.cpp` in modalità embedding (`/v1/embeddings`). Serve l'**asse A** del Router (cosine vs centroidi). |
| **tier-0**     | `llama.cpp` su CPU, modelli leggeri. Le richieste banali. |
| **tier-1**     | `vLLM` con GPU. In-compose (profilo `gpu`) o su server GPU in LAN. Le richieste impegnative. |
| **tier-2**     | Modelli cloud. Overflow / casi che il locale non regge. |
| **Redis** *(v2)* | Carico macchina + liveness dei nodi (heartbeat con TTL), letto dal Router. Niente conteggio token: lo fa già LiteLLM. |

---

## Come decide il Router: due assi

La decisione di tier **non** dipende solo dalla semantica della richiesta. Si
combinano due segnali indipendenti, e il tier finale è il `max` dei due.

### Asse B — taglia del payload *(deterministico, gratis, calcolato per primo)*
Token-count di query + allegati, confrontato con context-window e modalità di
ogni tier. È un **vincolo duro**: `"fixa questo" + 2000 righe` esce dal tier-0
perché non ci sta, a prescindere da quanto sia "semanticamente leggero".
L'allegato **non si embedda**, si misura.

### Asse A — complessità del task *(semantic router, solo sui tier fattibili)*
Embedding dell'**istruzione** + cosine similarity contro i **centroidi** delle
rotte. Approccio embedding-based, non un classificatore generativo: più veloce,
deterministico, si aggiusta aggiungendo frasi-esempio invece di toccare un prompt.

### La decisione
```
1. GATE (asse B)     → tier fattibili        (chi CI sta per taglia/modalità)
2. SEMANTIC (asse A) → tier preferito         (per complessità)
3. tier = il più economico fattibile ≥ preferito   ( = max(A, B) )
4. forward → LiteLLM con model = tier         (stream passthrough)
```

---

## Topologia

### v1 — sviluppo, fuori da kube
Tutto HTTP sincrono su una rete Docker. Coda, shim ed EdgeMesh **non servono**
(stessa rete = tutto raggiungibile). `llama-server` e vLLM espongono già endpoint
OpenAI-compatibili, quindi LiteLLM li fronteggia diretti.

```
api-router → litellm → { llama-tier0, vllm-tier1, cloud }
api-router → llama-embed   (per l'asse A)
```
Il **tier-1** (vLLM/GPU) è nel compose ma **dietro il profilo `gpu`**: il
`docker compose up` di default **non** lo avvia. Lo lanci da solo quando hai una GPU:
```bash
docker compose up -d vllm-tier1        # build + run, solo il tier-1
```
La stessa immagine può girare su un **server GPU esterno in LAN** (fuori dal
compose): in quel caso punta `TIER1_API_BASE` all'IP del server. Vedi
[`tier1-vllm/`](tier1-vllm/README.md).

### v2 — kube + edge *(futuro)*
- **Nodi core** (stabili): API/Router, LiteLLM, Redis, idealmente tier-1 vLLM
  (il warm-up della VRAM mal si sposa con l'effimero).
- **Nodi edge/spot** (KubeEdge): tier-0 `llama.cpp`, stateless e fungibili, con un
  **sidecar** che pubblica stato/liveness su Redis (TTL).
- Per il tier-0 effimero si passa a un **transport a coda** (RabbitMQ): i worker
  *pullano* i task (connessione in uscita) → niente raggiungibilità inbound, EdgeMesh
  evitato. Davanti alla coda uno **shim OpenAI-compatibile** così LiteLLM resta uniforme.

---

## Failover & resilienza

Il Router sceglie il tier giusto **a monte** (proattivo); LiteLLM gestisce gli
imprevisti **a valle** (reattivo). Configurato in `litellm/config.yaml`:

- **`fallbacks`** — su errore/timeout/saturazione scala al tier successivo.
- **`context_window_fallbacks`** — rete dedicata se il tier scelto sfora la
  context-window; copre l'approssimazione del tokenizer del gate (asse B).
- **`router_settings`** — `num_retries`, `timeout` (60s, perché tier-0 gira su CPU),
  `allowed_fails` + `cooldown_time` per mettere in pausa un backend che fallisce.

Le catene di fallback vanno **solo verso l'alto** (`tier-0 → tier-1 → tier-2`): un
fallback non può mai violare l'asse-B, al massimo finisce su un tier più capiente.

---

## Struttura del repo

```
mlops/
├─ api-router/            # il Router (Node/Fastify) — vedi api-router/README.md
│  ├─ src/router/         #   gate (asse B), semantic (asse A), decisione
│  ├─ config/             #   tiers.json, routes.seed.json
│  └─ scripts/, test/     #   build-centroids, smoke test
├─ tier1-vllm/            # immagine vLLM del tier-1 (in-compose o LAN) — suo README
├─ litellm/config.yaml    # model-group tier-0/1/2 + failover
├─ models/                # download-models.sh + data/ (i .gguf, gitignored)
├─ docker-compose.yml     # stack v1
├─ .env.example           # config: GGUF, chiavi, endpoint tier-1
└─ STATE.md               # diario di lavoro / decisioni
```

---

## Prerequisiti
- **Docker** + **Docker Compose**
- **Node 20+** (solo per gli script su host: `build-centroids` e `smoke`)

## Quick start (v1)

### 0. Configura e scarica i modelli
```bash
cp .env.example .env          # poi sistema i nomi GGUF se necessario
models/download-models.sh     # scarica i GGUF in ./models/data (~1.2 GB)
```

### 1. Tira su solo l'embedding
```bash
docker compose up -d llama-embed     # llama-server --embedding, su host :8080
```
Aspetta che il modello carichi (`docker compose logs -f llama-embed` → `listening`).

### 2. Centroidi + validazione del Router (da `api-router/`)
```bash
cd api-router
npm install
EMBED_URL=http://localhost:8080 node scripts/build-centroids.js   # → data/centroids.json
EMBED_URL=http://localhost:8080 npm run smoke                     # [A] gate + [B] semantic
cd ..
```
`build-centroids` è offline: embedda il seed in `data/centroids.json`, da rilanciare
quando cambi `config/routes.seed.json`. Lo smoke: [A] gate deterministico, [B] stampa
il tier scelto per alcune query (`"che ore sono"` → **tier-0**).

### 3. Su lo stack completo e prova (dalla root)
```bash
docker compose up -d          # default: api-router + litellm + llama-embed + llama-tier0
                              # (vllm-tier1 NON parte: è dietro il profilo gpu)
curl http://localhost:8000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"che ore sono"}]}'
```
Nei log di `api-router` compare il tier scelto per ogni richiesta. Per il tier-1 su
GPU: `docker compose up -d vllm-tier1`.

---

## Stato

Vedi [`STATE.md`](STATE.md) per lo stato corrente, le scelte fissate e le decisioni aperte.
