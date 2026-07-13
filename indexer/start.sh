#!/usr/bin/env sh
# Production start for the Ponder indexer on Render.
#
# Render's paid plans deploy with ZERO DOWNTIME: the old instance keeps running
# (and holding Ponder's Postgres schema lock) while the new instance boots. Two
# Ponder apps cannot share one schema, so a new instance on the same schema
# exits(1) with "Failed to acquire lock ... a different Ponder app is actively
# using this schema" and the deploy fails. (Free plans stop-first, so they never
# hit this.)
#
# Fix: give every INSTANCE its own schema, derived from Render's per-instance
# RENDER_INSTANCE_ID. New and old instances then never collide, so zero-downtime
# deploys (including instance-type changes) always succeed. Ponder's raw-chain
# sync store is shared across schemas, so re-indexing a fresh schema is fast.
#
# Note: each deploy leaves its predecessor's schema behind in Postgres. They are
# tiny (8 small tables) and can be dropped periodically; harmless if left.
set -e

RAW="${RENDER_INSTANCE_ID:-local}"
SUFFIX=$(printf '%s' "$RAW" | tr -cd 'a-z0-9')
[ -n "$SUFFIX" ] || SUFFIX="local"
SCHEMA="sdf_${SUFFIX}"

echo "[start.sh] Using Ponder schema '${SCHEMA}' (RENDER_INSTANCE_ID='${RAW}')"
exec ./node_modules/.bin/ponder start --schema "$SCHEMA"
