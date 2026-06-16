#!/usr/bin/env bash
set -euo pipefail

# Scarica i GGUF di default in ./models/data da HuggingFace (file pubblici).
# Uso:   models/download-models.sh
# Token (per modelli gated):   export HF_TOKEN=hf_xxx

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="${SCRIPT_DIR}/data"
mkdir -p "${MODELS_DIR}"

# coppie repo:file — tieni i nomi file allineati a .env (EMBED_GGUF / TIER0_GGUF)
MODELS=(
  "nomic-ai/nomic-embed-text-v1.5-GGUF:nomic-embed-text-v1.5.Q4_K_M.gguf"
  "Qwen/Qwen2.5-1.5B-Instruct-GGUF:qwen2.5-1.5b-instruct-q4_k_m.gguf"
)

for entry in "${MODELS[@]}"; do
  repo="${entry%%:*}"
  file="${entry##*:}"
  dest="${MODELS_DIR}/${file}"

  if [[ -f "${dest}" ]]; then
    echo "esiste già, salto: ${file}"
    continue
  fi

  url="https://huggingface.co/${repo}/resolve/main/${file}"
  echo "scarico ${file} da ${repo} ..."

  if [[ -n "${HF_TOKEN:-}" ]]; then
    curl -L --fail -H "Authorization: Bearer ${HF_TOKEN}" -o "${dest}" "${url}"
  else
    curl -L --fail -o "${dest}" "${url}"
  fi
done

echo "fatto. File in ${MODELS_DIR}:"
ls -lh "${MODELS_DIR}"/*.gguf
