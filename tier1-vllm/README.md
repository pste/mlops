# tier1-vllm

Immagine di serving del **tier-1** (vLLM, GPU). Due modi d'uso, stessa immagine:

1. **In-compose** (GPU sull'host del progetto): il servizio `vllm-tier1` del
   `docker-compose.yml` builda da questa cartella. È dietro il profilo `gpu`, quindi
   parte solo se lo lanci esplicitamente: `docker compose up -d vllm-tier1`.
2. **Su server GPU esterno in LAN** (questa cartella, fuori dal compose): build +
   `run.sh` sul server; LiteLLM lo raggiunge via IP di rete (`TIER1_API_BASE`).

Le istruzioni sotto coprono il caso **2**.

```
  host progetto                         server GPU (LAN)
  ┌──────────┐    http://<gpu-ip>:8000  ┌─────────────────┐
  │ LiteLLM  │ ───────────────────────▶ │  tier1-vllm     │
  │ (tier-1) │                          │  vLLM OpenAI API │
  └──────────┘                          └─────────────────┘
```

## Build (dove vuoi, anche sul server GPU)
```bash
docker build -t tier1-vllm:latest .
# versione vLLM personalizzabile:
docker build --build-arg VLLM_VERSION=v0.6.6 -t tier1-vllm:latest .
```

## Launch sul server GPU
```bash
cp .env.example .env        # scegli MODEL, PORT, tuning GPU, token HF
./run.sh                    # docker run --gpus all (no compose)
```
Verifica che risponda:
```bash
curl http://localhost:8000/v1/models
```
Il `served-model-name` è `tier-1` e DEVE combaciare col nome che LiteLLM invia.

## Wiring verso LiteLLM (sull'host del progetto)
Nel `.env` del progetto (root) imposta l'endpoint del server GPU:
```
TIER1_API_BASE=http://<ip-del-server-gpu>:8000/v1
TIER1_API_KEY=sk-noop          # o il VLLM_API_KEY se hai messo --api-key
```
Poi riavvia LiteLLM:
```bash
docker compose up -d litellm
```
Se il tier-1 non è raggiungibile, LiteLLM fa fallback verso tier-2 (configurato).

## Note
- Richiede **nvidia-container-toolkit** sul server GPU.
- La cache HF è montata da `HF_CACHE` → i pesi non si riscaricano a ogni avvio.
- Più repliche: lancia l'immagine su più server GPU e aggiungi le `api_base`
  come voci `tier-1` in `litellm/config.yaml` per avere load-balancing.
