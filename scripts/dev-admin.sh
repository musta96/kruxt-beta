#!/bin/bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd "$(dirname "$0")/../apps/admin"
exec npx next dev --port 3000
