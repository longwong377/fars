#!/bin/sh
# KTX=tools/blender/ktx_cli.sh in the cloud (see ktx_cli.mjs)
exec node "$(dirname "$0")/ktx_cli.mjs" "$@"
