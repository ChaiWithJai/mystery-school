#!/bin/sh
set -eu
# Explicit setup action. Builds an isolated vendor runtime; never changes global tools.
cd "$(dirname "$0")/.."
python3 scripts/setup-bonsai-local.py
