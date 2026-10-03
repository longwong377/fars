# Resolve merge conflicts in append-only records (DECISIONS, OPEN_QUESTIONS, BLOCKERS, PROGRESS, ASSET_LEDGER) by keeping both sides. Usage: python3 tools/dev/union_records.py <files...> (s18 lead)
import sys,re
for p in sys.argv[1:]:
    s=open(p).read()
    s=re.sub(r'<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', lambda m: m.group(1)+('' if m.group(1).endswith('\n') else '\n')+m.group(2), s, flags=re.S)
    open(p,'w').write(s)
