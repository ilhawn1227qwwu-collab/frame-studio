#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .venv/bin/activate ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
if [ ! -f .venv/.frame_installed ]; then
  python -m pip install -r requirements.txt
  touch .venv/.frame_installed
fi
python server.py
