#!/usr/bin/env bash
set -euo pipefail

# Lancia il server OpenAI di vLLM con parametri da env (default per singolo GPU).
# served-model-name DEVE combaciare col nome che LiteLLM invia (openai/<nome>).
MODEL="${MODEL:?serve MODEL (es. Qwen/Qwen2.5-7B-Instruct)}"
PORT="${PORT:-8000}"
SERVED_NAME="${SERVED_NAME:-tier-1}"
MAX_LEN="${MAX_MODEL_LEN:-32768}"
GPU_UTIL="${GPU_MEMORY_UTILIZATION:-0.90}"
TP="${TENSOR_PARALLEL_SIZE:-1}"

ARGS=(
  --model "${MODEL}"
  --served-model-name "${SERVED_NAME}"
  --host 0.0.0.0
  --port "${PORT}"
  --max-model-len "${MAX_LEN}"
  --gpu-memory-utilization "${GPU_UTIL}"
  --tensor-parallel-size "${TP}"
)

# Chiave API opzionale: se impostata, deve combaciare con api_key del tier-1
# in litellm/config.yaml (TIER1_API_KEY).
if [[ -n "${VLLM_API_KEY:-}" ]]; then
  ARGS+=(--api-key "${VLLM_API_KEY}")
fi

exec python3 -m vllm.entrypoints.openai.api_server "${ARGS[@]}"
