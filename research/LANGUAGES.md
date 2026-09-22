# LANGUAGES (Persepolis, 467 BCE, Xerxes year 19)

Researched on 2026-09-22. Livius, Iranica, ISAC, ORACC and Wikipedia are blocked for direct fetch. Where their text appears below,
it was read through **GitHub mirrors** or **web-search extracts**; the entry names which one. Tiers follow SITE_SPEC:
A = primary text or edition actually read; B = secondary or tertiary source read, or a primary text read through a mirror
that has not been checked against print; C = reconstruction or inference.

## 1. Who spoke and wrote what

| Language | Status at Persepolis c. 467 | Medium / script | Evidence | Tier |
|---|---|---|---|---|
| **Old Persian** | Spoken by the king, the court and the Persian nobility and population of Pārsa. **Written almost only for royal display**: rock, stone-jamb, column-base, foundation-plate and glazed-brick inscriptions. The Fortification Archive holds **one** Old Persian tablet | Old Persian cuneiform (semi-syllabic, 36 phonetic signs, 5 logograms, a word divider). Unicode block **U+103A0–U+103DF** | Livius inscription pages (via GitHub scrape); ARIo corpus; Stolper & Tavernier 2007 ARTA 2007.001 (search extract: "unique Fortification documents in Old Persian script and language") | A (inscriptions), B (tablet) |
| **Elamite** (Achaemenid Elamite) | **The language of administration** in the Persian heartland: "written in Elamite, the language of the Persian chancellery" (Livius, PF tablets, search extract). It is the main language of the Fortification tablets (509–493 BCE) and of the **Treasury tablets**, which cluster in Xerxes years 19–20, i.e. **our year** (CHRONOLOGY / `_date_decision_C.md`). It is also the second version of every trilingual royal inscription. Scribes were probably bilingual; whether Elamite was still anyone's first language in Fars is debated (not resolved here) | Elamite cuneiform on clay tablets, sealed. Unicode has no separate block; signs are encoded in **Cuneiform U+12000–U+123FF** (+ U+12400 numbers, U+12480 Early Dynastic) | Iranica "Persepolis Elamite tablets" and "Persepolis administrative archives" (search extracts); Livius "Persepolis Fortification Tablets" (search extract) | B |
| **Aramaic** (Imperial / Official Aramaic) | The empire's lingua franca and letter language. At Persepolis there are c. 500 Aramaic Fortification tablets or dockets, and Aramaic glosses on Elamite tablets (44 among Hallock's 2,120) (Wikipedia "Imperial Aramaic" and Iranica, search extracts). Aramaic was written in ink on leather and papyrus (Elephantine, Arshama letters) and in ink on tablets, jars and ritual stone objects. It was also the working language of the scribes who wrote to satraps | Aramaic alphabet, 22 consonants, right-to-left. Unicode **Imperial Aramaic U+10840–U+1085F** | Wikipedia "Imperial Aramaic"; USC West Semitic Research Project (search extracts) | B |
| **Babylonian (Akkadian)** | Third version of every royal trilingual (XPa, XPb, XPc, XPd…). A single Babylonian-language Fortification document exists (Stolper & Tavernier, extract). Babylonian scribes and craftsmen appear among the ration recipients. The Babylonian **calendar** is the backbone of dating (CALENDAR_AND_UNITS.md) | Babylonian cuneiform on stone and clay; Unicode Cuneiform block | ARIo XPa Akkadian text (§3); ARTA 2007.001 extract | A (inscription), B (tablet) |
| **Greek** | One Greek-language Fortification tablet (Stolper & Tavernier, extract). "Ionians" (Yauna) and Carians are among the ration-receiving workforce (secondary summaries, search extract). Greek-speaking craftsmen, envoys and exiles at court in 467 are **plausible (C)**. The attested Greek presence is of workers and officials, not a Greek community | Greek alphabet, ink/incised | ARTA 2007.001 extract; Iranica extracts | B (tablet); C (speech on site) |
| **Phrygian** | One tablet "probably in Phrygian script and language", not interpreted | Phrygian alphabet | ARTA 2007.001 extract | B |
| **Egyptian, Lydian, Lycian, Indian languages etc.** | Workers and delegations from these lands are shown on the Apadana reliefs and named in the tablets (Egyptians, Lycians, Indians in secondary summaries). **No Egyptian or Lydian text from Persepolis was located in this pass.** Egyptian objects (e.g. inscribed stone vessels in the Treasury) are known from general literature, but no source for them was seen here | – | – | C |
| **Median** | Loanwords inside Old Persian: e.g. *vispa-* 'all' in *vispazana-* and in the Akkadian version of XPa, *u-iš-pi-da-a-ʾ-i* (Kent 1953 s.v. *visadahyu-*, OCR via GitHub `sfmqrb/rishe`) | – | Kent (OCR) | B |

**Practical rule for the reconstruction:** Old Persian is **heard** at court (and seen carved). Elamite and Aramaic are **written**
in the offices, by the Treasury and the Fortification. Aramaic is **heard** from scribes, couriers and foreigners. Babylonian is
**seen** on the trilinguals. Greeks, Egyptians, Lydians, Ionians, Carians and Indians occur as **workers or delegations**.

## 2. Royal inscriptions standing in 467 BCE (by building)

Descriptions are quoted or paraphrased from Livius inscription pages, read through a scraped copy on GitHub
(`Electronic-Old-Persian-Library/Old-Persian-Dataset`, `textdata/web_scraping/*.txt`, commit e2ce246). Texts come from ARIo (§5).

| Siglum | Building (SITE_SPEC) | Where carved | Languages | Content (short) | Tier |
|---|---|---|---|---|---|
| **XPa** | Gate of All Nations | "inscribed in the walls of the Gate of all Nations". Wikipedia extract: "carved on the upper part of each doorway jamb" | OP, El, Bab | Gate named *duvarθim visadahyum*; full text §3 | A text / B placement |
| **XPb** | Apadana | "outer wall of the northern and eastern stairs of the Apadana" | OP, Bab, El | "What was done by me here, and ... farther off, I did by the grace of Ahuramazda" | A / B |
| **DPh** | Apadana (buried) | Foundation deposit: "two golden and two silver tablets ... discovered in a box in the northeastern corner of the Apadana" (Livius). **Not visible in 467**; do not render on the surface | OP, El, Bab | Extent of empire "from the Sacae beyond Sogdia to Kush, from Sind to Lydia" | A / B |
| **XPg** | Apadana | "on an ornamental plaque and on many glazed bricks" | OP | Xerxes completed works ordered by Darius | A / B |
| **DPa** | Tachara (Palace of Darius) | "above figures of the king and attendants" | OP (El, Bab versions = DPa-type) | "Darius ... who built this palace (*tacaram*)" | A / B |
| **DPb** | Tachara | "on the garment of Darius on a relief in his Palace" (one line) | OP | "Darius the great king, son of Hystaspes, an Achaemenid" | A / B |
| **DPc** | Tachara | "on the window corniches — as if the windows are speaking" | OP, El, Bab | ARIo: *ardastāna aθangaina Dārayavahauš xšāyaθiyahyā viθiyā kṛta* "stone window-frame made in the house of king Darius" | A / B |
| **XPc** | Tachara | "eastern pillar of the southern portico of Darius' Palace, added by Xerxes"; repeated on the western pillar; "a third copy ... on the south wall of the terrace on which the palace is built" | OP, El, Bab | "By the grace of Ahuramazda, my father, king Darius built this palace (*hadiš*)" | A / B |
| **DPi** | Tachara (object) | lapis-lazuli door knob: "Door-knob of precious stone, made in the palace of king Darius" | OP | – | B |
| **XPd** | Hadish (Palace of Xerxes) | "beside the stairs of the Palace of Xerxes and on the two pillars that once carried the roof of the northern portico" | OP, El, Bab | "I built this palace (*hadiš*)" | A / B |
| **XPe** | Hadish | "fourteen inscriptions in three languages ... from the Palace of Xerxes" (above figures on door jambs, per general literature, not verified) | OP, El, Bab | "Xerxes, the great king, king of kings, son of king Darius, the Achaemenid" | A / B (placement C) |
| **XPj / XPm** | Hadish / Harem | column bases, "found in the Queen's Quarters, but several may be from Palace of Xerxes" | OP, El, Bab | "I built this palace". ARIo XPj (Q007218) and XPm (Q007221) read *imam tacaram adam akunavam*; Elamite *hi ta₂-iz-za-ra*, Babylonian *E₂ ta-aš₂-ša₂-ri*, so Xerxes also called his palace *tacara* | A text / B placement |
| **XPk** | Hadish? | "on Xerxes' garment on a relief" | OP, El | "Xerxes, son of king Darius" | B |
| **XPf** | Harem | limestone slab "discovered in the queen's apartments"; four copies; Darius made Xerxes "the greatest (*maθišta*) after himself" | OP, Bab | Succession text | B (probably a foundation text, not a display; C) |
| **XPi** | Harem | lapis door knob "from the Palace of king Xerxes, found in the Queen's Quarters" | OP, El | – | B |
| **XPh** (Daiva) | (find-spot in Persepolis not given in the extract; "three slabs of stone from Persepolis and the citadel of Pasargadae") | slabs, probably foundation deposits → **not displayed** (C) | OP, El, Bab | Suppression of *daiva* worship | B |
| **DPd, DPe (OP), DPf (El), DPg (Bab)** | Terrace south wall | "on the terrace walls ... Southern wall" | separate texts per language | DPd: Pārsa is "full of good horses, full of good men"; prayer against "army, famine and the Lie" | A / B |

Placement of the Tachara/Hadish copies on specific jambs and piers is **B/C** until Schmidt, *Persepolis I* (1953) can be read.

### Where to get the published texts
- **Kent, R. G. 1953.** *Old Persian: Grammar, Texts, Lexicon* (2nd ed.). The standard sigla (XPa etc.) come from Kent. A scan is cited as
  `archive.org/details/oldpers` (seen as a reference in `sfmqrb/rishe`; archive.org is blocked here).
- **Schmitt, R. 2009.** *Die altpersischen Inschriften der Achaimeniden: Editio minor*. This is the current edition, digitised and lemmatised as
  **ORACC ARIo** (MOCCI, H. Heitmann-Gordon 2016–19, **CC0**). The mirror read here is `SLAB-NLP/Akk/data/jsonl/ario.jsonl`
  (175 texts, OP + El + Bab running text, no metadata). Its ids: XPa = Q007209, XPb = Q007210, XPc = Q007211, XPd = Q007212, DPd = Q007160,
  DPc = Q007159, DPa = Q007147/Q007157.
- **Lecoq, P. 1997.** *Les inscriptions de la Perse achéménide*. This is the literature cited on the Livius XPa page.
- **Livius.org** "Achaemenid Royal Inscriptions" (J. Lendering). It has Kent-style transliterations and English translations, and was read via the GitHub scrape.
- **UT Austin EIEOL**, *Old Iranian Online*, lessons 7–8 (Harvey, Lehmann, Slocum): word-by-word glosses of DB. Read via a GitHub copy
  (`galeorhinus/projects/.../ut-old-persian-70.html`, `-80.html`).

## 3. XPa: Gate of All Nations (full text)

**Old Persian, Kent-style transliteration, verbatim from the Livius page** (scraped copy, GitHub
`Electronic-Old-Persian-Library/Old-Persian-Dataset/textdata/web_scraping/XPa.txt`; `\` = word divider; hyphens are line breaks).
Tier **A** for the text (standard edition), **B** for this copy (not checked against Kent's print).

```
baga \ vazraka \ Auramazdâ \ hya \ imâm \ bûmim \ a-
dâ \ hya \ avam \ asmânam \ adâ \ hya \ martiyam \
adâ \ hya \ šiyâtim \ adâ \ martiyahyâ \ hya
\ Xšhayâršâm \ xšâyathiyam \ akunauš \ aivam \
parûnâm \ xšâyathiyam \ aivam \ parûnâm \ fram-
âtâram \ adam \ Xšayâršâ \ xšâyathiya \ vazraka \
xšâyathiya \ xšâyathiyânâm \ xšâyathiya \ dahy-
ûnâm \ paruv \ zanânâm \ xšâyathiya \ ahyây-
â \ bûmiyâ \ vazrakâyâ \ dûraiy \ apiy \ Dâ-
rayavahauš \ xšâyathiyahyâ \ puça \ Hâxâmaniš-
iya \ thâtiy \ Xšayâršâ \ xšâyathiya \ vašnâ \
Auramazdâhâ \ imam \ duvarthim \ visadahyum
\ adam \ akunavam \ vasiy \ aniyašciy \ naibam
\ kartam \ anâ \ Pârsâ \ tya \ adam \ akunavam \
utamaiy \ tya \ pitâ \ akunauš \ tyapatiy \ ka-
rtam \ vainataiy \ naibam \ ava \ visam \ vašnâ \ A-
uramazdâhâ \ akumâ \ thâtiy \ Xšayâršâ \
xšâyathiya \ mâm \ Auramazdâ \ pâtuv \ utamai-
y \ xšaçam \ utâ \ tya \ manâ \ kartam \ utâ \ tyamai-
y \ piça \ kartam \ avašciy \ Auramazdâ \ pâtuv
```
(The scrape reads `Xšhayâršâm` in line 4. This is probably a typo for `Xšayâršâm`, as the ARIo text below has *Xšayaṛšām*.)

**English (Livius translation, verbatim):**
> [1-6] A great god is Ahuramazda, who created this earth, who created heaven, who created man, who created happiness for man, who made Xerxes king, one king of many kings, commander of many commanders.
> [6-11] I am Xerxes, the great king, the king of kings, the king of all countries and many men, the king in this great earth far and wide, the son of Darius, an Achaemenid.
> [11-17] King Xerxes says: by the favor of Ahuramazda this Gate of All Nations I built. Much else that is beautiful was built in this Persepolis (Pârsâ), which I built and my father built. Whatever has been built and seems beautiful - all that we built by the favor of Ahuramazda.
> [17-20] King Xerxes says: may Ahuramazda preserve me, my kingdom, what has been built by me, and what has been built by my father. That, indeed, may Ahuramazda preserve.

**Schmitt/ARIo normalisation (Q007209), verbatim:** *baga vazṛka A.uramazdā haya imām būmim adā haya avam asmānam adā haya martiyam adā
haya šiyātim adā martiyahyā haya Xšayaṛšām xšāyaθiyam akunau̯š ai̯vam parūnām xšāyaθiyam ai̯vam parūnām framātāram adam Xšayaṛšā
xšāyaθiya vazṛka xšāyaθiya xšāyaθiyānām xšāyaθiya dahyunām paruzanānām xšāyaθiya ahyāyā būmiyā vazṛkāyā dūrai̯ api Dārayavahau̯š
xšāyaθiyahyā puça Haxāmanišiya θāti Xšayaṛšā xšāyaθiya vašnā A.uramazdāhā imam duvarθim Visadahyum adam akunavam vasai̯ aniyašci
nai̯bam kṛtam anā Pārsā taya adam akunavam utamai̯ taya pitā akunau̯š tayapati kṛtam vai̯natai̯ nai̯bam ava visam vašnā A.uramazdāhā akumā
θāti Xšayaṛšā xšāyaθiya mām A.uramazdā pātu utamai̯ xšaçam utā taya manā kṛtam utā tayamai̯ piça kṛtam avašci A.uramazdā pātu*

**The gate sentence in the other two versions (ARIo Q007209, verbatim):**
- Elamite: `za-u-mi-in {d}u-ra-mas-da-na hi {AŠ}e-el mi-is₂-sa₁₅ da-a-hu-iš {DIŠ}u₂ hu-ut-ta₂` ("by the favour of Ahuramazda this [gate?] 'All-Lands' I made"; the gloss of `{AŠ}e-el` is not confirmed, C)
- Babylonian: `ina GIŠ.MI ša₂ {d}a-hu-ru-ma-az-da-ʾ KA₂ a-ga-a u₂-ʾ-is-pi-da-a-ʾ-i MU-šu₂ a-na-ku e-te-pu-uš` ("in the protection of Ahuramazda
  this gate, *Vispadahyu* its name, I made"; KA₂ = *bābu* 'gate', MU-šu₂ = 'its name'). The Babylonian uses the Median form *vispa-* (Kent s.v. *visadahyu-*).

*visadahyu-* is attested only here (Kent 1953 lexicon p. 208: "visadahyum asm. XPa 12", OCR quoted in `sfmqrb/rishe`, page-133.json). Tier B.

For rendering, the Old Persian in native script is available sign by sign from the lexicon rules in `LEXICON/old_persian.json`
(`sign_spelling` → U+103A0 block). The full XPa text in native cuneiform was **not** generated: it needs Kent's sign-by-sign transliteration,
which was not available (C if done by rule).

## 4. Unicode notes
Verified against `UnicodeData.txt` (unicode-org/icu, GitHub raw).
- **Old Persian U+103A0–U+103D5**: 36 syllabic signs (A … HA; U+103C2 "SSA" is the sign transliterated **ç**), logograms
  U+103C8/9 AURAMAZDAA (-2), U+103CA AURAMAZDAAHA, U+103CB XSHAAYATHIYA, U+103CC/D DAHYAAUSH (-2), U+103CE BAGA, U+103CF BUUMISH,
  **U+103D0 word divider** (𐏐), numbers U+103D1–D5 (1, 2, 10, 20, 100).
- **Cuneiform U+12000–U+1239x** (1,255 code points in 12000–124FF counted in this file) covers Elamite and Babylonian signs by Sumerian sign name
  (e.g. U+122BA SHE + U+12047 BAR = ŠE.BAR 𒊺𒁇; U+120FE GESHTIN 𒃾; U+1202D AN = divine determinative).
- **Imperial Aramaic U+10840–U+10855** (22 letters), U+10857 section sign, numbers U+10858–1085F.
- Fonts: Noto Sans Old Persian, Noto Sans Cuneiform and Noto Sans Imperial Aramaic are the obvious open fonts (not checked in this pass).

## 5. Sources used (read, or seen as extracts)
1. Livius Achaemenid Royal Inscriptions pages: **scraped copy** on GitHub `Electronic-Old-Persian-Library/Old-Persian-Dataset` (CC-BY-NC; commit e2ce246), `textdata/web_scraping/{XPa,XPb,XPc,XPd,XPe,XPf,XPg,XPh,XPi,XPj,XPk,XPm,DPa,DPb,DPc,DPd,DPe,DPh,DPi}.txt`. **Read.**
2. ORACC ARIo (Schmitt 2009, MOCCI; CC0) as `SLAB-NLP/Akk/data/jsonl/ario.jsonl`. **Read.** The catalogue for three texts (not Persepolis) was also read in the `arvicco/nabu` test fixtures, to confirm the provenance and credits of ARIo.
3. UT Austin EIEOL Old Iranian lessons 7–8 (GitHub copy in `galeorhinus/projects`). **Read.**
4. Kent 1953 lexicon/grammar, OCR lines quoted in `sfmqrb/rishe` `data/verification/` (search hits only). **Seen.**
5. Web-search extracts: Iranica "Persepolis Elamite tablets", "Persepolis administrative archives", "Elam v."; Livius "Persepolis Fortification Tablets"; Wikipedia "Imperial Aramaic", "Gate of All Nations"; Stolper & Tavernier, ARTA 2007.001; USC WSRP. **Extracts only.**
6. UnicodeData.txt (unicode-org/icu). **Read.**
