# dev (D-250): move module-scope `var<private>` declarations that only `main` uses into main's body as function variables
# (an A/B for SwiftShader's compile time; the WGSL means the same). Usage: python3 tools/dev/wgsl_localize.py in.wgsl out.wgsl
import re, sys
src = open(sys.argv[1]).read()
m = re.search(r'\n@(fragment|vertex|compute)[^\n]*\nfn main\(', src)
head, body = src[:m.start()], src[m.start():]
# helper functions live in head after the declarations; a private used inside a helper must stay module-scope
decl = re.compile(r'^var<private> (\w+) : ([^;]+);\n', re.M)
names = decl.findall(head)
rest = decl.sub('', head)
keep, move = [], []
for n, t in names:
    (keep if re.search(r'\b' + n + r'\b', rest) else move).append((n, t))
head2 = decl.sub(lambda mm: mm.group(0) if (mm.group(1), mm.group(2)) in keep else '', head)
brace = body.index('{') + 1
body2 = body[:brace] + '\n' + ''.join(f'\tvar {n} : {t};\n' for n, t in move) + body[brace:]
open(sys.argv[2], 'w').write(head2 + body2)
print(f'moved {len(move)} privates into main, kept {len(keep)}')
