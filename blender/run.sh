#!/bin/sh
set -eu
SIDECAR_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export BLENDER_USER_CONFIG="$SIDECAR_DIR/runtime/config"
export BLENDER_USER_SCRIPTS="$SIDECAR_DIR/runtime/scripts"
export TMPDIR="$SIDECAR_DIR/runtime/tmp"
mkdir -p "$TMPDIR" "$BLENDER_USER_CONFIG" "$BLENDER_USER_SCRIPTS"
exec "$SIDECAR_DIR/runtime/Blender.app/Contents/MacOS/Blender" --background --factory-startup --python-exit-code 1 --python "$SIDECAR_DIR/build_school.py" "$@"
