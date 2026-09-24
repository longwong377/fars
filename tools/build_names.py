#!/usr/bin/env python3
"""Build /home/user/fars/src/data/names.json from
 (1) CDLI ATF dump (cdli-gh/data, cdliatf_unblocked.atf): Hallock PF texts with {hal}/{munus} names  -> tier A
 (2) EWB lemma base (DigitalPasts/ALP-MEGA2024, PN-EWB-EJSmith.csv + senses.js refs): achE hh./f. PNs -> tier B
SUPERSEDED IN PART (D-193): the EWB base states no licence (D-192, Q-294). Run tools/names_licensed.py after this script:
it drops the EWB names and fields and guesses the origins again from the spellings.
"""
import csv, json, re, unicodedata, collections, sys

SP = '/tmp/claude-0/-home-user-fars/19aeabec-257b-5649-97ad-5ff6575e56cc/scratchpad/'
OUT = '/home/user/fars/src/data/names.json'

# ---------------------------------------------------------------- helpers
def strip_acc(s):
    s = s.replace('δ', 'd').replace('ϑ', 'th').replace('ǰ', 'j').replace('`', '')
    s = s.replace('š', '\x01').replace('Š', '\x02')
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    return unicodedata.normalize('NFC', s).replace('\x01', 'š').replace('\x02', 'Š')

VOW = 'aeiu'

def join_syll(sylls):
    out = ''
    for n in sylls:
        if not n:
            continue
        if out and out[-1] in VOW and n[0] in VOW and len(n) > 1 and n[1] not in VOW:
            n = n[1:]          # CV-VC -> CVC (Hallock-style normalisation)
        out += n
    return out

def ewb_to_syll(tr):
    """EWB transliteration (hh.ba-qa-ba-na) -> list of plain syllables."""
    t = tr.split('.', 1)[1] if re.match(r'^\[?(hh|f|v|hw|h)\]?\.', tr) else tr
    t = re.sub(r'(^|[.\-])d\.', r'\1', t)   # divine determinative d. inside a name
    t = t.replace('.', '-')
    t = re.sub(r'[\[\]?…!<>]', '', t)
    t = strip_acc(t).lower()
    t = re.sub(r'(?<=[a-zš])\d+', '', t)    # tam5 -> tam, kap0 -> kap
    t = t.replace('q', 'k')
    return [x for x in t.split('-') if x]

def cdli_to_syll(atf):
    t = re.sub(r'\{[^}]*\}', '', atf)
    t = re.sub(r'[#!?<>\[\]_]', '', t)
    t = t.replace('sz', 'š').replace('s,', 'ṣ').replace('t,', 'ṭ')
    t = re.sub(r'(?<=[a-zšṣṭ])\d+', '', t)
    return [x for x in t.split('-') if x]

def norm_name(sylls):
    s = join_syll(sylls)
    return s[:1].upper() + s[1:]

def key(sylls):
    s = join_syll(sylls).replace('š', 's').replace('ṣ', 's').replace('ṭ', 't')
    s = s.translate(str.maketrans('ptgqy', 'bdkki'))
    s = re.sub(r'(.)\1+', r'\1', s)
    return s.lstrip('h')

# ---------------------------------------------------------------- (1) CDLI
cat = json.load(open(SP + 'pers_cat.json'))
texts = collections.defaultdict(list)
cur = None
for line in open(SP + 'cdliatf_unblocked.atf', encoding='utf-8'):
    if line.startswith('&P'):
        cur = line[1:8]
        continue
    if cur in cat:
        texts[cur].append(line.rstrip('\n'))

def pfno(p):
    d = cat[p]['designation']
    m = re.match(r'OIP 092, 0*(\d+)', d)
    return 'PF %s' % m.group(1) if m else d

# Manual curation of every {hal}/{munus} token in the 67 PF texts. Key = ATF token as it appears
# (after removing #!? damage marks); value = (canonical ATF stem, Hallock-translation name, role, flag)
# Genitive -na (after kurmin 'supplied by') is removed from the stem. Flags: 'title' / 'not_pn' tokens are skipped.
CUR = {
 'ma-ku-isz': ('ma-ku-isz', 'Makuš', 'receiver', ''),
 'u-man-na': ('u-man-na', 'Umanna', 'apportioner (šaramana)', ''),
 'zi2-ma-ak-ka4-na': ('zi2-ma-ak-ka4', 'Zimakka', 'supplier (kurmin)', ''),
 'asz2-ba-tasz-da': ('asz2-ba-tasz-da', 'Ašbatašda', 'receiver', ''),
 'ba-ka4-ba-da-na': ('ba-ka4-ba-da', 'Bakabada', 'supplier', ''),
 'ba-ka4-ba-da': ('ba-ka4-ba-da', 'Bakabada', 'receiver', ''),
 'ba-ka4-ba-ad-da': ('ba-ka4-ba-da', 'Bakabada', 'receiver', ''),
 'mu-isz-ka4-na': ('mu-isz-ka4', 'Muška', 'supplier', ''),
 'man-nu-un-da': ('man-nu-un-da', 'Mannunda', 'receiver', ''),
 'su-un-ka4-na-na': ('su-un-ka4-na', 'Sunkana', 'supplier', ''),
 'man-ma-ak-ka4': ('man-ma-ak-ka4', 'Manmakka', 'receiver; delivery man (ullira)', ''),
 'ra-u-za-iz-za-na': ('ra-u-za-iz-za', 'Rauzazza', 'supplier', ''),
 'ha-ud-da': ('ha-ud-da', 'Hadda', 'acquirer/transporter', ''),
 'man-ia-ba-du-isz-na': ('man-ia-ba-du-isz', 'Manyabaduš', 'supplier', ''),
 'ba-ka4-du-isz-da': ('ba-ka4-du-isz-da', 'Bakadušda', 'receiver / supplier', ''),
 'ba-ka4-du-isz-da-na': ('ba-ka4-du-isz-da', 'Bakadušda', 'supplier', ''),
 'par2-ru-na': ('par2-ru', 'Parru', 'supplier', ''),
 'ha-tur-ka4': ('ha-tur-ka4', 'Haturka', 'receiver', ''),
 'ba-ku-mar-da-na': ('ba-ku-mar-da', 'Bakumarda', 'supplier', ''),
 'kar-ki-isz': ('kar-ki-isz', 'Karkiš', 'receiver; dispatcher', ''),
 'bar-ru-szi-ia-ti-isz-na': ('bar-ru-szi-ia-ti-isz', 'Barušiyatiš', 'supplier', ''),
 'ha-za-ik-ra': ('ha-za-ik-ra', 'Hazzakra', 'receiver', ''),
 'ir-da-ba-ud-da': ('ir-da-ba-ud-da', 'Irdabada', 'receiver', ''),
 'na-ap-pu-pu-na': ('na-ap-pu-pu', 'Nappupu', 'supplier', ''),
 'na-ap-pu-pu': ('na-ap-pu-pu', 'Nappupu', 'receiver', ''),
 'ma-na-ak-ka4': ('ma-na-ak-ka4', 'Manakka', 'receiver', ''),
 'kar-ma-na': ('kar-ma', 'Karma', 'supplier', ''),
 'ir-tup-pi-ia-na': ('ir-tup-pi-ia', 'Irtuppiya', 'issuer of sealed document; sender of messenger', ''),
 'ka4-du-uk-ku': ('ka4-du-uk-ku', 'Kadukku', 'receiver/transporter', ''),
 'nap-zil0-la-na': ('nap-zil-la', 'Napzilla', 'supplier', ''),
 'man-ia-ak-ka4': ('man-ia-ak-ka4', 'Manyakka', 'receiver', ''),
 'ib-ba-ka4-ma-na': ('ib-ba-ka4-ma', 'Ibbakama', 'supplier', ''),
 'zab-ba-ra': ('zab-ba-ra', 'Zabbara', 'receiver/transporter', ''),
 'par2-me-uk-ka4-na': ('par2-me-uk-ka4', 'Parmekka', 'supplier', ''),
 'har-ri-u-mu-na': ('har-ri-u-mu-na', 'Harriumuna', 'receiver', ''),
 'har-ri-u-na': ('har-ri-u-mu-na', 'Harriumuna', 'receiver', ''),
 'u2-ti-ra-na': ('u2-ti-ra', 'Utira', 'supplier', ''),
 'ba-ku-be-sza2-na': ('ba-ku-be-sza2', 'Bakubeša', 'supplier', ''),
 'ti-ri-ia': ('ti-ri-ia', 'Tiriya', 'receiver', ''),
 'mi-ik-ra-isz-ba-na': ('mi-ik-ra-isz-ba', 'Mikrašba', 'supplier', ''),
 'am-mar-na': ('am-mar-na', 'Ammarna', 'acquirer/transporter', ''),
 'ma-ra-tam5-kasz': ('ma-ra-tam5-kasz', 'Maratamkaš', 'destination?; Hallock: "(PN?)"', 'uncertain'),
 'ba-sa-ak-ka4-na': ('ba-sa-ak-ka4', 'Basakka', 'supplier', ''),
 'bad-du-ma-ka4': ('bad-du-ma-ka4', 'Baddumaka', 'receiver/transporter', ''),
 'man-e-iz-za': ('man-e-iz-za', 'Manezza', 'receiver/transporter', ''),
 'man-tuk-ka4': ('man-tuk-ka4', 'Mantukka', 'receiver/transporter', ''),
 'par2-ru-isz': ('par2-ru-isz', 'Parruš', 'receiver', ''),
 'pir2-ri-e-na-na': ('pir2-ri-e-na', 'Pirrena', 'supplier (flour)', ''),
 'ap-pi-sza2-na': ('ap-pi-sza2-na', 'Appišana', 'receiver', ''),
 'ba-gi-iz-za-na': ('ba-gi-iz-za', 'Bakezza', 'supplier (flour)', ''),
 'par2-zi2-zi2': ('par2-zi2-zi2', 'Parzizi', 'transporter', ''),
 'ha-szi-na-na': ('ha-szi-na', 'Hašina', 'supplier', ''),
 'ba-be-na': ('ba-be-na', 'Babena', 'receiver / supplier', ''),
 'ba-be-na-na': ('ba-be-na', 'Babena', 'supplier', ''),
 'hu-musz-ti-ma-na': ('u2-musz-ti-ma', 'Umišduma', 'supplier', ''),
 'u2-musz-ti-ma-na': ('u2-musz-ti-ma', 'Umišduma', 'supplier', ''),
 'um-ma-nu-nu': ('um-ma-nu-nu', 'Ummanunu', 'receiver/transporter', ''),
 'isz-an-tu4': ('isz-an-tu4', 'Iššante', 'receiver/transporter', ''),
 'hu-pan-na-na': ('hu-pan-na-na', 'Hupannana', 'receiver', ''),
 'pir2-ri-asz2-ba': ('pir2-ri-ia-isz-ba', 'Pirriyašba', 'receiver', ''),
 'pir2-ri-ia-isz-ba': ('pir2-ri-ia-isz-ba', 'Pirriyašba', 'receiver', ''),
 'ap-pu-man-ia-na': ('ap-pu-man-ia', 'Appumanya', 'supplier', ''),
 'zi2-isz-szu-uk-ka4': ('zi2-isz-szu-uk-ka4', 'Ziššukka', 'transporter', ''),
 'ap-pir2-mar-sza2': ('ap-pir2-mar-sza2', 'Appirmarša', 'acquirer/transporter (wine)', ''),
 'ap-zi2-zi2-na': ('ap-zi2-zi2', 'Apzizi', 'supplier (wine)', ''),
 'ma-ni-iz-za': ('ma-ni-iz-za', 'Mannizza', 'receiver', ''),
 'mi-ut-ra-an-ka4': ('mi-ut-ra-an-ka4', 'Mitranka', 'apportioner (šarara)', ''),
 'mar-ri-ia-ad-da-na': ('mar-ri-ia-ad-da', 'Marriyadda', 'supplier (wine)', ''),
 'zi2-ra-zab-be': ('zi2-ra-zab-be', 'Zirazabbe', 'transporter; Hallock: or "Ziraza persons"', 'uncertain'),
 'na-ap-rap2-na': ('na-ap-rap2', 'Naprap', 'supplier (wine)', ''),
 'ba-ki-isz': ('ba-ki-isz', 'Bakiš', 'receiver/transporter; messenger of Irtuppiya', ''),
 'uk-ba-kur-na': ('uk-ba-kur-na', 'Ukbakurna', 'receiver/transporter (wine)', ''),
 'da-a-u2-uk-ka4': ('da-a-u2-uk-ka4', "Da'ukka", 'receiver; mardam(?) of Nariyapikna', ''),
 'na-ri-ia-pi-ik-na-na': ('na-ri-ia-pi-ik-na', 'Nariyapikna', 'superior of a mardam', ''),
 'na-ri-ia-pi-ik-na': ('na-ri-ia-pi-ik-na', 'Nariyapikna', 'superior of a mardam', ''),
 'u2-sza2-ia-na': ('u2-sza2-ia', 'Ušaya', 'supplier (wine)', ''),
 'ti-isz-sza2-an-tam5-ma': ('ti-isz-sza2-an-tam5-ma', 'Tiššantamma', 'receiver/transporter', ''),
 'bat-ti-ka4-ma-a-sza2': ('bat-ti-ka4-ma-a-sza2', 'Battikamaša', 'receiver (rations)', ''),
 'ir-isz-szu-ur-ra': ('ir-isz-szu-ur-ra', 'Iriššurra', 'receiver (rations); reading uncertain', 'uncertain'),
 'ir-da-a-sza2': ('ir-da-a-sza2', 'Irdaša', 'ansara official; receiver', ''),
 'bar-ru-uk-ka4': ('bar-ru-uk-ka4', 'Barukka', 'wine carrier (kutira)', ''),
 'hu-isz-da-na-na': ('u2-isz-da-na', 'Uštana', 'supplier (wine)', ''),
 'u2-isz-da-na-na': ('u2-isz-da-na', 'Uštana', 'supplier (wine)', ''),
 'ba-gi-rab2-ba': ('ba-gi-rab2-ba', 'Bakerabba', 'receiver (wine for the abbamuš)', ''),
 'ra-sa-ma-da-na': ('ra-sa-ma-da', 'Rasamada', 'supplier (flour)', ''),
 'ra-sa-ma-da-': ('ra-sa-ma-da', 'Rasamada', 'supplier (flour)', ''),
 'am-ma-ak-sze-ud-da': ('am-ma-ak-sze-ud-da', 'Yamakšedda', 'acquirer (flour for kurakaraš)', ''),
 'ba-du-za-ir-ma': ('ba-du-za-ir-ma', 'Baduzarma', 'receiver (flour for kurakaraš)', ''),
 'isz-ti-man-ka4-na': ('isz-ti-man-ka4', 'Ištimanka', 'supplier (flour)', ''),
 'ir-da-pu-ka4': ('ir-da-pu-ka4', 'Irdapukka', 'receiver (treasury flour)', ''),
 'ir-sze-na': ('ir-sze-na', 'Iršena', 'apportioner / assigner (treasury)', ''),
 'pir2-ma-ia-ba-da': ('pir2-ma-ia-ba-da', 'Pirmayabadda', 'receiver; reading uncertain', 'uncertain'),
 'mi-isz-sza2-ba-ad-da': ('mi-isz-sza2-ba-ad-da', 'Miššabadda', 'receiver', ''),
 'mi-isz-pa-na': ('mi-isz-pa-na', 'Mišpana', 'transporter', ''),
 'ba-du-isz-du-isz': ('ba-du-isz-du-isz', 'Badušduš', 'transporter; "the Mannaraziyan"; reading uncertain', 'uncertain'),
 'szu-te-na-na': ('szu-te-na', 'Šutena', 'supplier (figs)', ''),
 'na-ba-ba': ('na-ba-ba', 'Nabbaba', 'receiver', ''),
 'man-gi-isz-na': ('man-gi-isz', 'Mankeš', 'supplier (wheat); reading uncertain', 'uncertain'),
 'ku-ri-iz-za': ('ku-ri-iz-za', 'Kurizza', 'receiver/transporter', ''),
 'ma-nu-isz': ('ma-nu-isz', 'Manuš', 'grain handler (tumara)', ''),
 'u2-pir2-ra-ad-da': ('u2-pir2-ra-ad-da', 'Upirradda', 'receiver', ''),
 'ki-ni-mu-ur-na': ('ki-ni-mu-ur', 'Kinimur', 'entrusted with commodity', ''),
 'sa-ak-ti-ti-na': ('sa-ak-ti-ti', 'Saktiti', 'supplier (sesame)', ''),
 'ap-pi-szu-ka4': ('ap-pi-szu-ka4', 'Appišukka', 'receiver', ''),
 'ba-ka4-ba-na-na': ('ba-ka4-ba-na', 'Bakabana', 'supplier (livestock for slaughter)', ''),
 'am-pir2-da-u-isz': ('am-pir2-da-u-isz', 'Ampirdawiš', 'receiver of hides', ''),
 'sza2-a-ka4-da': ('sza2-a-ka4-da', 'Šakada', 'receiver of hides; delivers to treasury at Shiraz', ''),
 'ir-tam5-na': ('ir-tam5', 'Irtam', 'supplier (livestock)', ''),
 'ir-ti-ma': ('ir-ti-ma', 'Irtima', 'receiver of hides; companion of Šakada', ''),
 'mar-du-nu-ia-na': ('mar-du-nu-ia', 'Mardunuya', 'supplier (ewes); Hallock translates "Mardonius"', ''),
 # not personal names although written with a person determinative
 'kan2-ti-ra-ik-ki-mar': None,   # 'from the storekeeper'
 'ak-ka4-ia-sze-ik-ki': None,    # 'companion(s)'
 'ak-ka4-ia-sze': None,
 'kur-tasz': None,               # 'workers'
 'eszszana-na-ma': None, 'eszszana-na': None,  # 'king'
 'mar-da-um': None, 'mar-da-mar-da-um': None, # title mardam
}
TITLES_F = {'ab-ba-mu-isz-na'}   # {munus}abbamuš: title (Hallock: "the abbamuš (woman)")

cdli = {}   # canonical atf -> record
unhandled = []
skipped_nonpn = collections.Counter()
for p, lines in texts.items():
    for i, l in enumerate(lines):
        if l.startswith('#') or l.startswith('&'):
            continue
        for det, tok in re.findall(r'\{(hal|munus)[#!?]*\}(\S+)', l):
            clean = re.sub(r'[#!?]', '', tok).replace('<na>', 'na').replace('<', '').replace('>', '').replace('_', '')
            clean = re.sub(r'\[|\]', '', clean)
            if det == 'munus':
                if clean in TITLES_F:
                    skipped_nonpn['abbamuš (title, {munus})'] += 1
                    continue
            if clean not in CUR:
                unhandled.append((p, tok))
                continue
            v = CUR[clean]
            if v is None:
                skipped_nonpn[clean] += 1
                continue
            stem, name, role, flag = v
            r = cdli.setdefault(stem, {'name': name, 'atf': '{%s}%s' % (det, stem), 'sex': 'm' if det == 'hal' else 'f',
                                       'texts': [], 'roles': [], 'flag': flag, 'spellings': set()})
            r['spellings'].add('{%s}%s' % (det, re.sub(r'[#!?]', '', tok)))
            t = '%s (%s)' % (pfno(p), p)
            if t not in r['texts']:
                r['texts'].append(t)
            for part in re.split(r' / |; ', role):
                if part not in r['roles']:
                    r['roles'].append(part)
if unhandled:
    print('UNHANDLED', unhandled, file=sys.stderr)
print('CDLI names', len(cdli), 'skipped', dict(skipped_nonpn), file=sys.stderr)

# ---------------------------------------------------------------- (2) EWB
rows = list(csv.DictReader(open(SP + 'alp/Elamite_materials/EWB-EJSmithFiles/PN-EWB-EJSmith.csv', encoding='utf-8')))
s = open(SP + 'alp/js/data/senses.js', encoding='utf-8').read()
senses = json.loads(s[s.index('{'):].rstrip().rstrip(';'))

def ewbref(tr):
    v = senses.get(tr)
    if v and v.get('reference', {}).get('page'):
        return 'EWB %s:%s' % (v['reference']['volume'], v['reference']['page'])
    return 'EWB (page not given in lemma base)'

def freq(r):
    try:
        return int(r['frequency'])
    except ValueError:
        return 0

ach = [r for r in rows if 'achE' in r['period']]
ewb_by_key = collections.defaultdict(list)
for r in ach:
    if re.match(r'^\[?(hh|f)\]?\.', r['transliteration']):
        ewb_by_key[key(ewb_to_syll(r['transliteration']))].append(r)

# ---------------------------------------------------------------- origin
SEMITIC_AKK = ['bel', 'nabu', 'marduk', 'samas', 'ili', 'etir', 'iddin', 'nasir', 'upaqu', 'ittannu', 'itti-', 'zer', 'ahhe', 'sum-', 'nergal']
WSEM = ['barik', "`el", 'sames', 'esqu']
ELAM_ETYM = ['humban', 'huban', 'kiten', 'tempt', 'sati-', 'napir', 'nap-', 'red', '-sg', '-pl', '3sg', 'imp', 'poss', 'king', 'kindaddu', 'kur-', 'hazi', 'utu', 'insusinak', 'hutran', 'sutur', 'silhak']
ELAM_FORM = ['humban', 'umban', 'huban', 'hupan', 'umpan', 'kitin', 'kiten', 'napir', 'insusinak', 'susinak', 'hutran', 'sutruk', 'sutur', 'kutur', 'kutir', 'tepti', 'temti', 'silhak', 'hanni', 'attahamiti', 'hamiti', 'sati']
BAB_FORM = ['nabu', 'marduk', 'samas', 'nergal', 'iddin', 'belsu', 'belit', 'ahhe', 'zeri']

def origin_from_etym(et):
    e = strip_acc(et).lower().replace('š', 's')
    if any(x in e for x in ['hindu', 'hindau']):
        return 'Indian', 'EWB etymon *%s = "Indian" (ethnic-type name); the name is an Iranian formation' % et
    if re.fullmatch(r'yauna(ka)?', e):
        return 'Greek', 'EWB etymon *%s ("Ionian", ethnic-type name)' % et
    if re.fullmatch(r'mudr[aā]ya', e) or e.startswith('mudray'):
        return 'Egyptian', 'EWB etymon *%s ("Egyptian")' % et
    if any(x in e for x in ['sparda', 'spardaya']):
        return 'Anatolian', 'EWB etymon *%s ("Lydian/Sardian")' % et
    if any(x in e for x in WSEM):
        return 'West Semitic', 'EWB gives a West Semitic/Aramaic etymon (%s)' % et
    if any(x in e for x in SEMITIC_AKK):
        return 'Babylonian', 'EWB gives an Akkadian etymon (%s)' % et
    if any(x in e for x in ELAM_ETYM) or re.search(r'-(red|sg|pl|3sg)\b', e):
        return 'Elamite', 'EWB analyses it as Elamite (%s)' % et
    if 'yauna' in e:
        return 'Iranian', 'EWB gives an Old Iranian compound *%s containing yauna- ("Ionian"?); Iranian formation' % et
    return 'Iranian', 'EWB gives an Old Iranian etymon *%s' % et

def origin_from_form(nm):
    n = strip_acc(nm).lower().replace('š', 's')
    if n == 'kubaba':
        return 'Anatolian', 'name of the Anatolian/North Syrian goddess Kubaba'
    for x in ELAM_FORM:
        if x in n:
            return 'Elamite', 'contains Elamite onomastic element "%s"' % x
    for x in BAB_FORM:
        if x in n:
            return 'Babylonian', 'contains Akkadian theophoric/verbal element "%s"' % x
    return 'unknown', 'no etymon in EWB lemma base and no diagnostic element'

def ewb_etym(r):
    et = r['cognate'] or r['morphology']
    if not et:
        return None
    if not r['cognate'] and not re.search(r'[āīūϑδçčǰxvṛ]|rt', et) and not any(x in et.lower() for x in ELAM_ETYM + SEMITIC_AKK):
        return None   # morphology note that is neither an Iranian etymon nor a clear analysis
    # capitalised plain names in 'morphology' with no cognate (e.g. Hazakra, Appuka) are just normalisations
    if not r['cognate'] and re.fullmatch(r"[A-Z][a-zšḫ\-]+\??", r['morphology']) and not any(x in r['morphology'].lower() for x in ELAM_ETYM + SEMITIC_AKK):
        return None
    return et.split(',')[0].strip()

NOTABLE = {  # etymon stems (diacritics stripped, lowercase) of royal / top-official names
 'darayavau': 'royal name (Darius)', 'xsayarsa': 'royal name (Xerxes)', 'kurus': 'royal name (Cyrus)',
 'kambujiya': 'royal name (Cambyses)', 'vistaspa': 'royal family (Hystaspes)', 'arsama': 'royal family (Arsames)',
 'artaxsaca': 'royal name (Artaxerxes)', 'farnaka': 'name of Parnakka, Darius-era head of the Persepolis administration',
 'cicava': 'name of Ziššawiš, Parnakka\'s deputy', 'rtabama': 'Irdabama, elite/royal woman of the PF archive',
 'rtastuna': 'Irtašduna (Artystone), wife of Darius', 'aspacana': 'Ašbazana (Aspathines), high official',
 'baratkama': 'Baratkama, treasurer at Persepolis (PF/PT)', 'cutayauda': 'Šuddayauda, PT treasury official',
 'gaubaruva': 'Gobryas, high noble', 'haxamanis': 'Achaemenes (dynastic ancestor)',
}
def notable(et, nm):
    e = re.sub(r'[^a-z]', '', strip_acc(et or '').lower())
    for k, why in NOTABLE.items():
        if e.startswith(k):
            return why
    return None

# ---------------------------------------------------------------- assemble
out = []
used_ewb_keys = set()
for stem, r in cdli.items():
    k = key(cdli_to_syll(stem))
    match = ewb_by_key.get(k, [])
    rec = {
        'name': r['name'].replace("'", "’"),
        'atf': r['atf'],
        'sex': r['sex'],
        'texts': r['texts'][:5],
        'count': len(r['texts']),
        'archive': 'PF',
        'source': 'CDLI',
        'role_in_text': '; '.join(r['roles']),
    }
    if len(r['spellings']) > 1:
        rec['spellings'] = sorted(r['spellings'])
    et = None
    if match:
        used_ewb_keys.add(k)
        best = max(match, key=freq)
        rec['ewb'] = {'lemma': best['transliteration'], 'ref': ewbref(best['transliteration'])}
        et = next((ewb_etym(m) for m in sorted(match, key=freq, reverse=True) if ewb_etym(m)), None)
    if r['name'] == 'Badušduš':
        og, ob = 'unknown', 'text labels him a Mannaraziyan ({asz}ma-an-na-ra-zi2-ia-ra, gentilic of a place); name unanalysed'
    elif r['name'] == 'Mardunuya':
        og, ob = 'Iranian', 'Hallock/CDLI translation renders it "Mardonius" (Greek form of OIr *Mṛduniya); not in the EWB hh. lemmas'
    elif et:
        og, ob = origin_from_etym(et)
    else:
        og, ob = origin_from_form(r['name'])
    rec['origin_guess'], rec['origin_basis'] = og, ob
    rec['tier'] = 'A (name form, primary text) / C (origin guess)'
    if r['flag'] == 'uncertain':
        rec['reading_uncertain'] = True
    nb = notable(et, r['name'])
    if nb:
        rec['notable'] = nb
    out.append(rec)

# EWB supplement: achE, HAL (hh.) or MUNUS (f.) determinative.
EXCL_F = {'f.ab-ba-mu-iš', 'f.ab-ba-ak-iš', 'f.ab-ba-uk-iš', 'f.ku-h', 'f.ba-na-[x]', 'f.za-qa-[…]'}
cands = collections.defaultdict(list)  # group spelling variants by etymon (or by key when no etymon)
for r in ach:
    tr = r['transliteration']
    if not re.match(r'^(hh|f)\.', tr):          # excludes v./hw./h./[hh] etc.
        continue
    if tr in EXCL_F or re.search(r'x|…', tr.split('.', 1)[1]):   # illegible or broken-off: not a usable name
        continue
    fem = tr.startswith('f.')
    bad = bool(re.search(r'[?\[\]…x]', tr.split('.', 1)[1]))
    if bad and not fem:
        continue
    sy = ewb_to_syll(tr)
    _et = ewb_etym(r)
    _og = origin_from_etym(_et)[0] if _et else origin_from_form(norm_name(sy))[0]
    if not fem and freq(r) < 2 and _og in ('Iranian', 'unknown'):
        continue
    k = key(sy)
    if k in used_ewb_keys:
        continue
    et = ewb_etym(r)
    g = ('F' if fem else 'M') + '|' + (strip_acc(et).lower() if et else 'k:' + k)
    cands[g].append(r)

for g, rs in cands.items():
    rs.sort(key=lambda r: (-freq(r), bool(re.search(r'[?\[\]]', r['transliteration']))))
    best = rs[0]
    tr = best['transliteration']
    fem = tr.startswith('f.')
    nm = norm_name(ewb_to_syll(tr))
    et = ewb_etym(best)
    og, ob = origin_from_etym(et) if et else origin_from_form(nm)
    rec = {
        'name': nm,
        'atf': tr,
        'sex': 'f' if fem else 'm',
        'texts': [],
        'count': None,
        'ewb_freq': sum(freq(r) for r in rs) or None,
        'archive': 'achE (PF/PT not distinguished)',
        'source': 'EWB',
        'ewb': {'lemma': tr, 'ref': ewbref(tr)},
        'origin_guess': og,
        'origin_basis': ob,
        'tier': 'B (name form from Hinz & Koch EWB lemma base; primary text not seen) / C (origin guess)',
    }
    if len(rs) > 1:
        rec['spellings'] = [r['transliteration'] for r in rs]
    if re.search(r'[?\[\]…]', tr):
        rec['reading_uncertain'] = True
    nb = notable(et, nm)
    if nb:
        rec['notable'] = nb
    out.append(rec)

# de-duplicate identical normalised names within the EWB supplement (keep higher freq)
seen = {}
final = []
for rec in out:
    k2 = (rec['name'].lower(), rec['sex'])
    if k2 in seen:
        prev = seen[k2]
        prev.setdefault('spellings', [prev['atf']])
        if rec['atf'] not in prev['spellings']:
            prev['spellings'].append(rec['atf'])
        if prev['source'] == 'EWB' and rec.get('ewb_freq'):
            prev['ewb_freq'] = (prev.get('ewb_freq') or 0) + rec['ewb_freq']
        continue
    seen[k2] = rec
    final.append(rec)

final.sort(key=lambda r: (r['source'] != 'CDLI', r['sex'] != 'f' if r['source'] == 'EWB' else False,
                          -(r['count'] or 0), -(r.get('ewb_freq') or 0), r['name']))

meta = {
 'generated': '2026-09-23',
 'purpose': 'Pool of attested personal names for unnamed NPCs (brief §9.1: never invent names; match to origin).',
 'source': [
  {'id': 'CDLI', 'what': 'CDLI bulk ATF dump, Hallock PF texts (OIP 92) with CDLI English translations',
   'file': 'https://github.com/cdli-gh/data (cdliatf_unblocked.atf, LFS sha256 2896ec25…d836, fetched via media.githubusercontent.com); catalogue cdli_cat.csv',
   'coverage': '67 Persepolis Fortification texts only (PF 1–60, 400–406 = OIP 092 0001–0060, 0400–0406). No PT (Cameron, OIP 65) text is in the dump.',
   'licence': 'CDLI terms of use (cdli.earth/terms-of-use, seen as a search extract only): data "may be freely copied, aggregated and re-used according to common and fair academic practice"; re-use of considerable data must cite CDLI. The cdli-gh/data repo has no LICENSE file. Transliterations/translations derive from Hallock, PF (OIP 92, 1969), which ISAC distributes as a free PDF. Cite: CDLI + Hallock PF no.'},
  {'id': 'EWB', 'what': 'Hinz & Koch, Elamisches Wörterbuch (1987), personal-name lemmas as digitised in the DANES-ALP "MEGA" lemma base (E. J. Smith files)',
   'file': 'https://github.com/DigitalPasts/ALP-MEGA2024 Elamite_materials/EWB-EJSmithFiles/PN-EWB-EJSmith.csv (+ js/data/senses.js for EWB volume:page), commit 3160b20f',
   'coverage': 'Achaemenid Elamite (achE) lemmas written with HAL (hh.) or MUNUS (f.) determinative. EWB draws on PF, PF-NN (Hallock unpublished), PT and inscriptions; the lemma base does not say which text.',
   'licence': 'No licence stated in the repository. Names are used as bare facts (form, sex, etymon) with EWB page citation; do not redistribute the CSV. Flag for review before public release.'},
 ],
 'method': 'CDLI: every {hal}/{munus} token in the 67 PF texts was curated by hand against the CDLI/Hallock translation line; genitive -na after kurmin ("supplied by") removed; titles and role nouns written with {hal} (kurtaš, sunki/EŠŠANA, mardam, kantira-ikkimar, akkayašeikki, {munus}abbamuš) excluded. Name = Hallock translation form (diacritics except š dropped). EWB: achE lemmas with hh./f. determinative; male names kept only if the lemma base frequency field ≥ 2 and the reading is undamaged; all female lemmas kept (damaged ones flagged reading_uncertain) except the title abbamuš; spelling variants with the same EWB etymon merged; lemmas already matched to a CDLI name merged into that record. EWB names normalised mechanically: determinative dropped, accents/indices stripped, q→k, CV-VC → CVC.',
 'fields': {'count': 'CDLI: number of distinct PF texts in the dump with the name (null for EWB-only names).',
            'ewb_freq': 'frequency column of the EWB lemma base (meaning undocumented; plausibly number of references cited). Used only for ranking; it is NOT a verified attestation count.',
            'archive': '"PF" = attested in a CDLI PF text; "achE (PF/PT not distinguished)" = EWB lemma, archive unknown.',
            'notable': 'name of a royal or top official; avoid for generic NPCs unless it is meant to be that person.',
            'role_in_text': 'what the person does in the cited PF texts (from the translation).'},
 'tiers': {'A': 'name form read in a primary text (CDLI transliteration of Hallock PF).',
           'B': 'name form from a standard secondary lexicon (EWB) — primary text not seen this session.',
           'C': 'origin_guess: from etymology or onomastic element, not from an ethnic label in the text (only Badušduš has a gentilic label). EWB (Hinz) etymologies are often over-Iranianising; treat as C.'},
 'origin_values': 'Iranian | Elamite | Babylonian | West Semitic | Egyptian | Greek | Anatolian | Indian | unknown ("West Semitic" added for Aramaic-type names).',
}
json.dump({'_meta': meta, 'names': final}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
c = collections.Counter
print('total', len(final), file=sys.stderr)
print('source', c(r['source'] for r in final), file=sys.stderr)
print('sex', c((r['source'], r['sex']) for r in final), file=sys.stderr)
print('origin', c(r['origin_guess'] for r in final), file=sys.stderr)
print('origin CDLI', c(r['origin_guess'] for r in final if r['source'] == 'CDLI'), file=sys.stderr)
print('notable', [(r['name'], r['notable']) for r in final if r.get('notable')], file=sys.stderr)
print('>=2 CDLI', sum(1 for r in final if (r['count'] or 0) >= 2), file=sys.stderr)
