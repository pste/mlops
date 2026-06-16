# Immagine di serving tier-1 (vLLM, GPU). Si builda da questo repo ma NON gira
# nel docker-compose del progetto: viene lanciata su server GPU dedicati in LAN.
ARG VLLM_VERSION=v0.6.6
FROM vllm/vllm-openai:${VLLM_VERSION}

# I parametri di lancio (modello, porta, tuning GPU) sono guidati da env:
# vedi entrypoint.sh e .env.example.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
