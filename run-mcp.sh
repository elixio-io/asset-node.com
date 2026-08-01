#!/bin/bash
cd "$(dirname "$0")"
exec node --import tsx/esm src/mcp/server.ts
