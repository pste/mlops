#!/usr/bin/env bash
set -euo pipefail

# Lancia il container tier-1 sul server GPU (LAN). NON usa docker-compose.
# Richiede nvidia-container-toolkit. Config via .env (copia da .env.example).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

IMAGE="${IMAGE:-tier1-vllm:latest}"
PORT="${PORT:-8000}"

# Passa le sole env di runtime al container; monta la cache HF per non
# riscaricare i pesi a ogni avvio.
docker run -d --name tier1-vllm \
  --gpus all \
  --restart unless-stopped \
  -p "${PORT}:${PORT}" \
  -e MODEL -e SERVED_NAME -e PORT -e MAX_MODEL_LEN \
  -e GPU_MEMORY_UTILIZATION -e TENSOR_PARALLEL_SIZE \
  -e VLLM_API_KEY -e HUGGING_FACE_HUB_TOKEN \
  -v "${HF_CACHE:-$HOME/.cache/huggingface}:/root/.cache/huggingface" \
  "${IMAGE}"

echo "tier1-vllm avviato su :${PORT} (modello: ${MODEL:-?})"
