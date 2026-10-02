#!/bin/sh
# BLENDER=tools/blender/bpy_cli.sh for tools/blender/build.mjs in the cloud (see bpy_cli.py). BPY_PYTHON: the venv's python with bpy.
exec "${BPY_PYTHON:-$HOME/bpy/bin/python}" "$(dirname "$0")/bpy_cli.py" "$@"
