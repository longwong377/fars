# A `blender` command-line front end over the bpy module (session 17, cloud): lets tools/blender/*.mjs run in a container
# with no Blender install. `pip install bpy` (5.0.1, the same version as Vagon's Blender) gives a Python module, not the
# blender binary; this accepts the subset of the CLI the project's scripts use:
#   bpy_cli --version
#   bpy_cli -b [--factory-startup] [--python-exit-code N] --python <script.py> [-- args...]
# The script runs as __main__ with sys.argv = [blender, <all args>] so its own `sys.argv[sys.argv.index('--') + 1:]` works.
# CPU only (no GPU in the cloud): scripts that pick a Cycles device fall back to CPU.
import sys, runpy, traceback

def main(argv):
    if '--version' in argv:
        import bpy
        print(f'Blender {bpy.app.version_string}'); return 0
    script = None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--': break
        if a == '--python': script = argv[i + 1]; i += 2; continue
        i += 1
    if not script:
        print('bpy_cli: only `--version` and `-b --python <script> [-- args]` are supported', file=sys.stderr); return 2
    import bpy
    if '--factory-startup' in argv:
        bpy.ops.wm.read_factory_settings(use_empty=False)
    sys.argv = ['blender'] + argv
    try:
        runpy.run_path(script, run_name='__main__')
    except SystemExit as e:
        return int(e.code or 0) if not isinstance(e.code, str) else 1
    except Exception:
        traceback.print_exc(); return 1
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
