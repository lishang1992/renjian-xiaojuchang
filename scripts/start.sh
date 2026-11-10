#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"

if [ -s /usr/local/opt/nvm/nvm.sh ]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1091
  . /usr/local/opt/nvm/nvm.sh
  nvm use --delete-prefix 24 --silent
fi

current_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$current_major" != "24" ]; then
  echo "当前 Node.js 版本不是 24。请先运行：source /usr/local/opt/nvm/nvm.sh && nvm install 24"
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

npm run build
exec npm start
