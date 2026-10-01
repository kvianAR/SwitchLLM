#!/usr/bin/env bash
# The SwitchLLM installer moved to https://freellmapi.co/install.sh
# This shim keeps old `curl ... github.io ... | bash` one-liners working.
set -euo pipefail
exec bash -c "$(curl -fsSL https://freellmapi.co/install.sh)"
