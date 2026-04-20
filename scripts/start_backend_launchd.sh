#!/bin/zsh

set -euo pipefail

PROJECT_ROOT="/Users/ovz/Documents/project/bybit-bots"
BACKEND_DIR="${PROJECT_ROOT}/backend"
LOG_DIR="${PROJECT_ROOT}/db/tmp"
NODE_BIN_DIR="/Users/ovz/.nvm/versions/node/v24.13.0/bin"
NVM_DIR="/Users/ovz/.nvm"

mkdir -p "${LOG_DIR}"

export HOME="/Users/ovz"
export NVM_DIR
export PATH="${NODE_BIN_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

if [ -s "${NVM_DIR}/nvm.sh" ]; then
  . "${NVM_DIR}/nvm.sh"
fi

cd "${BACKEND_DIR}"

exec npm run start
