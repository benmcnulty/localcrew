#!/usr/bin/env bash
set -euo pipefail

HOST="http://127.0.0.1:11434"
MODEL=""
OUTPUT_DIR="."
APPLY=0

usage() {
  cat <<'EOF'
Usage: ./scripts/ollama-optimize-linux.sh [--host URL] [--model MODEL] [--output-dir DIR] [--apply]

Benchmarks the local Ollama node, recommends a top/mid/low tier, chooses a practical
context length, and prints the environment commands to use when starting Ollama.

By default the script does not change your system. Use --apply to write an
`ollama-recommended.env` file and, when `systemctl --user` is available, set the
recommended environment variables for the current user session.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --apply)
      APPLY=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

command -v curl >/dev/null || { echo "curl is required." >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required." >&2; exit 1; }

mkdir -p "$OUTPUT_DIR"

TAGS_JSON="$(curl -fsS "$HOST/api/tags")"

if [[ -z "$MODEL" ]]; then
  MODEL="$(
    python3 - "$TAGS_JSON" <<'PY'
import json
import sys

data = json.loads(sys.argv[1])
models = [entry.get("name", "") for entry in data.get("models", [])]
preferences = [
    "gpt-oss",
    "qwen3-coder",
    "llama3.1",
    "llama3.2",
    "qwen",
    "gemma"
]

filtered = [
    model for model in models
    if model and "embed" not in model and "embedding" not in model
]

for preference in preferences:
    for model in filtered:
        if preference in model:
            print(model)
            raise SystemExit(0)

if filtered:
    print(filtered[0])
    raise SystemExit(0)

raise SystemExit("No benchmarkable local models were found.")
PY
  )"
fi

MEMORY_GB="$(
  python3 - <<'PY'
from pathlib import Path

mem_total_kb = 0
for line in Path("/proc/meminfo").read_text().splitlines():
    if line.startswith("MemTotal:"):
        mem_total_kb = int(line.split()[1])
        break

print(round((mem_total_kb * 1024) / (1024 ** 3), 1))
PY
)"

CPU_NAME="$(
  lscpu 2>/dev/null | awk -F: '/Model name/ {sub(/^[ \t]+/, "", $2); print $2; exit}'
)"

HOSTNAME_VALUE="$(hostname -s)"
BENCHMARK_PATH="${OUTPUT_DIR%/}/ollama-profile-${HOSTNAME_VALUE}.json"
ENV_PATH="${OUTPUT_DIR%/}/ollama-recommended.env"

CONTEXT_CANDIDATES="$(
python3 - "$MEMORY_GB" <<'PY'
import sys
memory_gb = float(sys.argv[1])
if memory_gb >= 48:
    print("8192 16384 32768 65536 131072")
elif memory_gb >= 24:
    print("8192 16384 32768 65536")
elif memory_gb >= 12:
    print("4096 8192 16384 32768")
else:
    print("4096 8192 16384")
PY
)"

echo "Benchmarking ${MODEL} on ${HOST} with candidate contexts: ${CONTEXT_CANDIDATES}"

RESULTS_JSON="$(
  python3 - "$HOST" "$MODEL" "$CONTEXT_CANDIDATES" <<'PY'
import json
import sys
import time
import urllib.error
import urllib.request

host = sys.argv[1].rstrip("/")
model = sys.argv[2]
candidates = [int(value) for value in sys.argv[3].split()]
prompt = (
    "Summarize how this node should contribute to a distributed Ollama swarm in five short bullets. "
    "Focus on delegation, queueing, memory, and documentation hygiene."
)

results = []

for candidate in candidates:
    payload = json.dumps(
        {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_ctx": candidate,
                "num_predict": 64,
                "temperature": 0
            }
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{host}/api/generate",
        data=payload,
        headers={"content-type": "application/json"},
        method="POST",
    )

    started = time.perf_counter()
    try:
      with urllib.request.urlopen(request, timeout=180) as response:
        body = json.loads(response.read().decode("utf-8"))
      elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
      results.append(
          {
              "num_ctx": candidate,
              "ok": True,
              "elapsed_ms": elapsed_ms,
              "eval_count": body.get("eval_count"),
          }
      )
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
      elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
      results.append(
          {
              "num_ctx": candidate,
              "ok": False,
              "elapsed_ms": elapsed_ms,
              "error": str(error),
          }
      )

print(json.dumps(results))
PY
)"

PROFILE_JSON="$(
  python3 - "$MODEL" "$MEMORY_GB" "$CPU_NAME" "$RESULTS_JSON" <<'PY'
import json
import sys

model = sys.argv[1]
memory_gb = float(sys.argv[2])
cpu_name = sys.argv[3]
results = json.loads(sys.argv[4])

successful = [entry for entry in results if entry["ok"]]
if not successful:
    raise SystemExit("No successful benchmark runs were recorded.")

baseline = successful[0]["elapsed_ms"]
recommended = successful[0]
for entry in successful:
    if entry["elapsed_ms"] <= baseline * 4:
        recommended = entry

recommended_ctx = recommended["num_ctx"]

if memory_gb >= 24 and recommended_ctx >= 32768:
    tier = "top"
elif memory_gb >= 12 and recommended_ctx >= 16384:
    tier = "mid"
else:
    tier = "low"

recommendations = {
    "OLLAMA_CONTEXT_LENGTH": str(recommended_ctx),
    "OLLAMA_FLASH_ATTENTION": "1",
    "OLLAMA_NUM_PARALLEL": "2" if tier == "top" else "1",
    "OLLAMA_MAX_LOADED_MODELS": "2" if tier == "top" else "1",
    "OLLAMA_MAX_QUEUE": "256" if tier == "top" else ("128" if tier == "mid" else "64"),
    "OLLAMA_KEEP_ALIVE": "30m" if tier == "top" else ("15m" if tier == "mid" else "10m"),
}

profile = {
    "platform": "linux",
    "model": model,
    "tier": tier,
    "memory_gb": memory_gb,
    "cpu": cpu_name,
    "benchmark_results": results,
    "recommended_context_length": recommended_ctx,
    "recommended_env": recommendations,
}

print(json.dumps(profile))
PY
)"

printf '%s\n' "$PROFILE_JSON" > "$BENCHMARK_PATH"

echo
echo "Saved profile: $BENCHMARK_PATH"
echo
cat "$BENCHMARK_PATH"

echo
echo "Recommended commands:"
python3 - "$PROFILE_JSON" <<'PY'
import json
import sys

profile = json.loads(sys.argv[1])
for key, value in profile["recommended_env"].items():
    print(f"export {key}={value}")
PY

python3 - "$PROFILE_JSON" > "$ENV_PATH" <<'PY'
import json
import sys

profile = json.loads(sys.argv[1])
for key, value in profile["recommended_env"].items():
    print(f"{key}={value}")
PY

echo "Wrote recommended environment file: $ENV_PATH"

if [[ "$APPLY" -eq 1 ]]; then
  echo
  if command -v systemctl >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
    echo "Applying recommended environment variables with systemctl --user set-environment..."
    while IFS='=' read -r key value; do
      [[ -n "$key" ]] || continue
      systemctl --user set-environment "${key}=${value}"
    done < "$ENV_PATH"
    echo "Applied to the user systemd environment. Restart Ollama to pick up the changes."
  else
    echo "--apply requested, but user systemd is unavailable."
    echo "Load the values from $ENV_PATH into the environment used to start Ollama."
  fi
fi
