// Scripted speech lines (brief §9.4 "They respond in their own language … Dialogue is scripted"; §10 "Old Persian
// lines are short and draw only on the lexicon").
//
// Rules this file follows (enforced by tests/language.test.ts):
//  * a line's only in-world content is `words`: lexicon ids (src/lang/lexicon.ts). What is heard is the concatenation
//    of those entries' IPA; nothing else in a line is ever voiced or rendered in the world;
//  * `gloss` (English) and `note`/`src`/tiers are out-of-world: subtitles in the translation layer and the dev overlay;
//  * no word is invented and no inflection is made up: if a line needs a form the lexicon lacks, the line is omitted and
//    the gap is listed in LEXICON_GAPS below and in research/OPEN_QUESTIONS.md (Q-022 … Q-026, Q-134, Q-135);
//  * five languages have lexicons: Old Persian, Elamite, Aramaic, Babylonian (D-105) and Ionic Greek (D-106);
//  * every line carries tiers: the phrase (A = verbatim word sequence in a published text, B = excerpt of one, C = composed
//    from lexicon words), the usage (spoken, in this situation: always C or at best B) and the words' own lexicon tiers.
//    Pronunciation (IPA) is reconstructed for every entry (lexicon tier_ipa C), so every line is tier C overall.
import { lexEntry, LangId, LexEntry, isSpeakable, citationForm, worstTier } from '../lang/lexicon';
import type { SpeakableLine, Intonation, VoiceParams } from '../audio/speech';
import { Rng, hashString } from '../core/rng';

export type Intent = 'greet' | 'reply' | 'farewell' | 'pious' | 'remark' | 'call_workers' | 'count' | 'offer' | 'identify' | 'ask_document'
  | 'affirm' | 'refuse' | 'ration';

export interface LineDef {
  id: string; lang: LangId; intent: Intent;
  /** lexicon ids in spoken order — the ONLY in-world content of a line */
  words: string[];
  intonation?: Intonation;
  /** sim roles that use the line (omitted = anyone who speaks the language) */
  roles?: string[];
  // ---- out-of-world
  gloss: string; phraseTier: 'A' | 'B' | 'C'; usageTier: 'B' | 'C'; src: string; note: string;
}

export const LINE_DEFS: LineDef[] = [
  // ---------------- Old Persian: royal-inscription formulas only (no everyday phrase survives; see LEXICON_GAPS)
  { id: 'op.pious.baga_vazrka', lang: 'op', intent: 'pious', words: ['op:baga', 'op:vazṛka', 'op:Auramazdā'],
    gloss: 'A great god is Ahuramazda.', phraseTier: 'A', usageTier: 'C', src: 'XPa 1 (also XPb, XPc, XPd): baga vazṛka A.uramazdā',
    note: 'opening words of the royal inscriptions, verbatim; spoken as a pious exclamation is a reconstruction' },
  { id: 'op.farewell.auramazda_patu', lang: 'op', intent: 'farewell', words: ['op:Auramazdā', 'op:pātu'],
    gloss: 'May Ahuramazda protect.', phraseTier: 'B', usageTier: 'C', src: 'XPa 18–20: (mām) A.uramazdā pātu',
    note: 'excerpt of the closing prayer without its object; used as a leave-taking blessing (C)' },
  { id: 'op.remark.parsa_uvaspa', lang: 'op', intent: 'remark', words: ['op:Pārsa', 'op:uvaspa-', 'op:umartiya-'],
    gloss: 'Pārsa: good horses, good men.', phraseTier: 'B', usageTier: 'C', src: 'DPd: … Pārsa … uvaspā umartiyā',
    note: 'excerpt of the Terrace-wall text describing Pārsa; spoken as local pride (C)' },
  { id: 'op.pious.vasna_auramazdaha', lang: 'op', intent: 'pious', words: ['op:vašnā', 'op:A.uramazdāha'],
    gloss: 'By the favour of Ahuramazda.', phraseTier: 'A', usageTier: 'C', src: 'DB, DSf passim (ARIo Q007134, Q007172): vašnā A.uramazdāha',
    note: 'the commonest formula of the inscriptions, verbatim; spoken as a pious aside it is a reconstruction (C)' },
  { id: 'op.farewell.dargam_jiva', lang: 'op', intent: 'farewell', words: ['op:dargam', 'op:jīvā'],
    gloss: 'Live long!', phraseTier: 'A', usageTier: 'C', src: 'DB 4 (ARIo Q007134): utā dargam jīvā',
    note: 'the blessing on the future king in DB, verbatim; as a leave-taking between people it is a reconstruction (C)' },
  { id: 'op.affirm.hasiyam', lang: 'op', intent: 'affirm', words: ['op:hašiya-'],
    gloss: '(That is) true.', phraseTier: 'C', usageTier: 'C', src: 'DB 4 (ARIo Q007134): ima hašiyam nai̯ duruxtam',
    note: 'no Old Persian "yes" survives; "true" from DB stands in (C)' },
  { id: 'op.refuse.nai', lang: 'op', intent: 'refuse', words: ['op:nai̯'], roles: ['guard', 'official', 'courier'],
    gloss: 'No. (lit. "not")', phraseTier: 'C', usageTier: 'C', src: 'lexicon op:nai̯ (DNb, DB)', note: 'the negation used alone as a refusal (C)' },
  { id: 'op.refuse.ma', lang: 'op', intent: 'refuse', words: ['op:mā'], roles: ['guard'], intonation: 'fall',
    gloss: "Don't!", phraseTier: 'C', usageTier: 'C', src: 'lexicon op:mā (DNa "mā avarada")', note: 'the prohibitive particle alone: a guard stopping someone (C)' },
  { id: 'op.call_workers.paraita', lang: 'op', intent: 'call_workers', words: ['op:parai̯tā'], roles: ['official'],
    gloss: 'Go forth! (pl.)', phraseTier: 'B', usageTier: 'C', src: 'DB (ARIo Q007134): parai̯tā avam kāram … jantā',
    note: 'a military order in DB, used by an official sending a group off (C)' },
  { id: 'op.identify.adam_rstika', lang: 'op', intent: 'identify', words: ['op:adam', 'op:ṛštika'], roles: ['guard'],
    gloss: '(I am a) spearman.', phraseTier: 'C', usageTier: 'C', src: 'lexicon op:adam (XPa), op:ṛštika (DNb "ṛštika ami")',
    note: 'composed from two attested words; DNb has "ṛštika ami" with the verb, which the lexicon lacks (gap Q-022)' },
  { id: 'op.remark.vasai_naibam', lang: 'op', intent: 'remark', words: ['op:vasai̯', 'op:naiba-'], roles: ['official', 'guard', 'courier'],
    gloss: 'Very fine.', phraseTier: 'C', usageTier: 'C', src: 'XPa 13 (ARIo Q007209): vasai̯ aniyašci nai̯bam',
    note: 'two words of one XPa clause ("much else beautiful"), shortened (C)' },
  { id: 'op.count.aiva', lang: 'op', intent: 'count', words: ['op:ai̯va-'], roles: ['official', 'porter'],
    gloss: 'One.', phraseTier: 'C', usageTier: 'C', src: 'lexicon op:ai̯va- (XPa)',
    note: 'the only Old Persian number written out in the texts read (acc. ai̯vam); others are numerals, so counting goes on in Aramaic or Elamite' },
  // ---------------- Elamite: inscription formulas + administrative vocabulary
  { id: 'el.pious.nap_irsarra', lang: 'el', intent: 'pious', words: ['el:nap', 'el:iršarra', 'el:Uramasda'],
    gloss: 'A great god is Ahuramazda.', phraseTier: 'A', usageTier: 'C', src: 'XPa Elamite 1: {d}na-ap ir-ša₂-ir-ra {d}u-ra-mas-da',
    note: 'opening of the Elamite version, verbatim; spoken use C' },
  { id: 'el.farewell.uramasda_nuskisni', lang: 'el', intent: 'farewell', words: ['el:Uramasda', 'el:nuškišni'],
    gloss: 'May Ahuramazda protect.', phraseTier: 'B', usageTier: 'C', src: 'XPa Elamite, end: {d}u-ra-mas-da (un) nu-iš-ki₂-iš-ni',
    note: 'excerpt without the object pronoun; leave-taking blessing (C)' },
  { id: 'el.ask_document.halmi', lang: 'el', intent: 'ask_document', words: ['el:halmi'], intonation: 'rise', roles: ['guard', 'official', 'scribe'],
    gloss: '(Your) sealed document?', phraseTier: 'C', usageTier: 'C', src: 'lexicon el:halmi (Hallock PF 15 "hal-mi {hal}ir-tup-pi-ia-na", CDLI)',
    note: 'halmi is now read in a primary text (PF 15, tier A, Q-131); the one-word question carried by intonation and gesture is a reconstruction (C)' },
  { id: 'el.call_workers.kurtas', lang: 'el', intent: 'call_workers', words: ['el:kurtaš'], roles: ['foreman'],
    gloss: 'Workers!', phraseTier: 'C', usageTier: 'C', src: 'lexicon el:kurtaš (PF tablets, Iranica extracts)',
    note: 'the administrative word for the royal workforce used as a call; whether it was a spoken address is unknown (C)' },
  { id: 'el.ration.gal', lang: 'el', intent: 'ration', words: ['el:gal'], roles: ['foreman', 'official', 'scribe', 'porter'],
    gloss: 'Rations!', phraseTier: 'C', usageTier: 'C', src: 'lexicon el:gal (PF 35, 50)', note: "the tablets' word for rations as a call at the issue (C)" },
  { id: 'el.ration.kurtas_gal', lang: 'el', intent: 'ration', words: ['el:kurtaš', 'el:gal'], roles: ['foreman', 'official', 'scribe'],
    gloss: "Workers' rations.", phraseTier: 'B', usageTier: 'C', src: 'PF 50 (CDLI P382736): {hal}kur-taš gal-li',
    note: 'excerpt of the PF phrase without its suffix (-li)' },
  { id: 'el.remark.dusda', lang: 'el', intent: 'remark', words: ['el:dušda'], roles: ['scribe', 'porter'],
    gloss: '(He) received (it).', phraseTier: 'C', usageTier: 'C', src: 'PF 2, 8 (CDLI): du-iš-da', note: 'the receipt formula of the tablets, said aloud at a delivery (C)' },
  { id: 'el.identify.hutlak', lang: 'el', intent: 'identify', words: ['el:hutlak'], roles: ['courier'],
    gloss: '(A) messenger.', phraseTier: 'C', usageTier: 'C', src: 'PF 45 (CDLI P382731): hu-ut-lak', note: 'one-word self-identification (C)' },
  { id: 'el.identify.ullira', lang: 'el', intent: 'identify', words: ['el:ullira'], roles: ['porter'],
    gloss: '(The) deliverer.', phraseTier: 'C', usageTier: 'C', src: 'PF 54; EWB 2:1221', note: 'one-word self-identification (C)' },
  { id: 'el.refuse.inni', lang: 'el', intent: 'refuse', words: ['el:inni'],
    gloss: 'No. (lit. "not")', phraseTier: 'C', usageTier: 'C', src: 'lexicon el:inni (ARIo Elamite versions)', note: 'the negation alone as a refusal (C)' },
  { id: 'el.refuse.anu', lang: 'el', intent: 'refuse', words: ['el:anu'], roles: ['guard', 'foreman', 'official'],
    gloss: "Don't!", phraseTier: 'C', usageTier: 'C', src: 'lexicon el:anu (XPh Elamite)', note: 'the prohibitive alone (C)' },
  { id: 'el.count.kir', lang: 'el', intent: 'count', words: ['el:kir'], roles: ['scribe', 'porter', 'foreman'],
    gloss: 'One.', phraseTier: 'C', usageTier: 'C', src: 'XPh Elamite (ARIo Q007216): ki-ir', note: 'the only Elamite number word in the texts read; the tablets write numerals' },
  // ---------------- Aramaic: the lingua franca (letter formulas + Biblical Aramaic vocabulary)
  { id: 'arc.greet.slm', lang: 'arc', intent: 'greet', words: ['arc:šlm'],
    gloss: 'Greetings. (lit. "peace")', phraseTier: 'B', usageTier: 'C', src: 'letter openings "šlm PN" (Elephantine, Arshama letters; lexicon arc:šlm)',
    note: 'the written greeting word; its spoken use as a greeting is inferred (C)' },
  { id: 'arc.greet.slm_mra', lang: 'arc', intent: 'greet', words: ['arc:šlm', 'arc:mrʾ'],
    gloss: 'Greetings, lord.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:šlm, arc:mrʾ',
    note: 'composed; letters address superiors as mrʾy "my lord", but that suffixed form has no lexicon entry (gap Q-024), so the bare noun is used' },
  { id: 'arc.reply.slm', lang: 'arc', intent: 'reply', words: ['arc:šlm'],
    gloss: 'Greetings. (lit. "peace")', phraseTier: 'B', usageTier: 'C', src: 'letter formula (lexicon arc:šlm)', note: 'returning the greeting (C)' },
  { id: 'arc.count.hd_trn_tlt', lang: 'arc', intent: 'count', words: ['arc:ḥd', 'arc:trn', 'arc:tlt'], intonation: 'level', roles: ['porter', 'scribe', 'official', 'foreman'],
    gloss: 'One, two, three.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:ḥd, arc:trn, arc:tlt (Biblical Aramaic numerals)',
    note: 'counting sacks or jars aloud (C)' },
  { id: 'arc.offer.lhm', lang: 'arc', intent: 'offer', words: ['arc:lḥm'], roles: ['baker', 'grinder'],
    gloss: 'Bread.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:lḥm', note: 'offering or naming bread (C)' },
  { id: 'arc.identify.spr', lang: 'arc', intent: 'identify', words: ['arc:spr'], roles: ['scribe'],
    gloss: '(I am a) scribe.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:spr', note: 'one-word self-identification (C)' },
  { id: 'arc.identify.igra', lang: 'arc', intent: 'identify', words: ['arc:ʾgrh'], roles: ['courier'],
    gloss: '(A) letter.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:ʾgrh', note: 'a courier naming what he carries (C)' },
  { id: 'arc.greet.slm_lyk', lang: 'arc', intent: 'greet', words: ['arc:šlm', 'arc:ʿlyk'],
    gloss: 'Peace be upon you.', phraseTier: 'B', usageTier: 'C', src: 'Elephantine ostracon "ʿl ʾḥy mtrdt šlm ʿlyk" (Iranica "Correspondence", search extract)',
    note: 'the written greeting of a letter, verbatim but read only through an extract (B); spoken use C' },
  { id: 'arc.greet.slm_ahy', lang: 'arc', intent: 'greet', words: ['arc:šlm', 'arc:ʾḥy'], roles: ['mason', 'porter', 'foreman', 'scribe', 'baker', 'grinder'],
    gloss: 'Greetings, my brother.', phraseTier: 'C', usageTier: 'C', src: 'letter address "ʿl ʾḥy PN" + šlm (Elephantine, search extract)',
    note: 'composed from the letter address and the greeting word; between equals (C)' },
  { id: 'arc.greet.slma_kla', lang: 'arc', intent: 'greet', words: ['arc:šlmʾ', 'arc:klʾ'], roles: ['official', 'scribe', 'courier'],
    gloss: 'All peace!', phraseTier: 'A', usageTier: 'C', src: 'Ezra 5:7 (OSHB): šlmʾ klʾ', note: "the greeting of a governor's letter to Darius, verbatim; formal (C)" },
  { id: 'arc.reply.slm_lyk', lang: 'arc', intent: 'reply', words: ['arc:šlm', 'arc:ʿlyk'],
    gloss: 'Peace be upon you.', phraseTier: 'B', usageTier: 'C', src: 'Elephantine ostracon (search extract)', note: 'returning the greeting (C)' },
  { id: 'arc.farewell.slm', lang: 'arc', intent: 'farewell', words: ['arc:šlm'],
    gloss: 'Peace.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:šlm', note: 'the greeting word as a leave-taking (C)' },
  { id: 'arc.affirm.yssyba', lang: 'arc', intent: 'affirm', words: ['arc:yṣybʾ'],
    gloss: 'Certainly!', phraseTier: 'B', usageTier: 'C', src: 'Dan 3:24 (OSHB): yaṣṣîḇāʾ malkāʾ', note: 'an answer "certainly (so)" in Daniel (later than 467); spoken use C' },
  { id: 'arc.affirm.tb', lang: 'arc', intent: 'affirm', words: ['arc:ṭb'],
    gloss: 'Good.', phraseTier: 'C', usageTier: 'C', src: 'Ezra 5:17 (OSHB): ṭāḇ', note: 'assent (C)' },
  { id: 'arc.refuse.la', lang: 'arc', intent: 'refuse', words: ['arc:lʾ'],
    gloss: 'No.', phraseTier: 'C', usageTier: 'C', src: 'Ezra 4:13 etc. (OSHB): lāʾ', note: 'the negation alone (C)' },
  { id: 'arc.call_workers.osparna', lang: 'arc', intent: 'call_workers', words: ['arc:ʾsprnʾ'], roles: ['foreman', 'official'],
    gloss: 'Diligently! (with all speed)', phraseTier: 'C', usageTier: 'C', src: 'Ezra 5:8 (OSHB): ʿbydtʾ dk ʾsprnʾ mtʿbdʾ',
    note: "the Persian loanword of the chancery (\"this work is done diligently\") as a foreman's urging (C)" },
  { id: 'arc.call_workers.sbqw', lang: 'arc', intent: 'call_workers', words: ['arc:šbqw'], roles: ['foreman'],
    gloss: 'Leave it! (stop)', phraseTier: 'C', usageTier: 'C', src: 'Ezra 6:7 (OSHB): šbqw', note: 'the imperative "let (the work) alone" as a call to stop (C)' },
  { id: 'arc.call_workers.azl', lang: 'arc', intent: 'call_workers', words: ['arc:ʾzl'], roles: ['foreman', 'official', 'guard'],
    gloss: 'Go!', phraseTier: 'C', usageTier: 'C', src: 'Ezra 5:15 (OSHB): ʾēzel', note: 'the imperative alone (C)' },
  { id: 'arc.count.hd_trn_tlt_arb', lang: 'arc', intent: 'count', words: ['arc:ḥd', 'arc:trn', 'arc:tlt', 'arc:ʾrbʿ'], intonation: 'level', roles: ['porter', 'scribe', 'official', 'foreman'],
    gloss: 'One, two, three, four.', phraseTier: 'C', usageTier: 'C', src: "lexicon arc:ḥd, trn, tlt (Strong's), ʾrbʿ (Ezra 6:17)", note: 'counting sacks or jars aloud (C)' },
  { id: 'arc.ration.wheat_salt_wine_oil', lang: 'arc', intent: 'ration', words: ['arc:ḥnṭyn', 'arc:mlḥ', 'arc:ḥmr', 'arc:mšḥ'], roles: ['scribe', 'official', 'porter'],
    gloss: 'Wheat, salt, wine, oil.', phraseTier: 'B', usageTier: 'C', src: 'Ezra 6:9 (OSHB): wḥnṭyn mlḥ ḥmr wmšḥ',
    note: 'the commodity list of a royal grant, verbatim without its conjunctions; read out at an issue (C)' },
  { id: 'arc.ration.npqta', lang: 'arc', intent: 'ration', words: ['arc:npqtʾ'], roles: ['official', 'scribe'],
    gloss: 'The allowance. (lit. "the expenses")', phraseTier: 'C', usageTier: 'C', src: 'Ezra 6:4, 6:8 (OSHB)', note: "the word for costs paid out by the king's house (C)" },
  { id: 'arc.ask_document.igra', lang: 'arc', intent: 'ask_document', words: ['arc:ʾgrh'], intonation: 'rise', roles: ['guard', 'official', 'scribe'],
    gloss: '(A) letter?', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:ʾgrh', note: 'a one-word question by intonation (C)' },
  // ---------------- Babylonian (Late Babylonian): royal-inscription phrases and letter words (D-105)
  { id: 'bab.greet.sulmu', lang: 'bab', intent: 'greet', words: ['bab:šulmu'],
    gloss: 'Greetings. (lit. "well-being")', phraseTier: 'C', usageTier: 'C', src: 'LB letter greetings "šulmu [u balāṭu] … qabû" (Hackl & Jursa, extract); RIBo šu-lum',
    note: 'the letter word for well-being as a spoken greeting (C); no spoken LB greeting is attested' },
  { id: 'bab.greet.sulmu_beliya', lang: 'bab', intent: 'greet', words: ['bab:šulmu', 'bab:bēlīya'], roles: ['scribe', 'mason', 'porter'],
    gloss: 'Greetings, my lord.', phraseTier: 'C', usageTier: 'C', src: 'letter address "ana bēlīya" + šulmu (extract)', note: 'polite, to a superior (C)' },
  { id: 'bab.reply.sulmu', lang: 'bab', intent: 'reply', words: ['bab:šulmu'],
    gloss: 'Greetings. (lit. "well-being")', phraseTier: 'C', usageTier: 'C', src: 'lexicon bab:šulmu', note: 'returning the greeting (C)' },
  { id: 'bab.farewell.lissur', lang: 'bab', intent: 'farewell', words: ['bab:Aḫuramazdaʾ', 'bab:liṣṣur'],
    gloss: 'May Ahuramazda protect.', phraseTier: 'A', usageTier: 'C', src: 'XPa Babylonian, end (ARIo Q007209): {d}a-hu-ru-ma-az-da-ʾ li-iṣ-ṣur',
    note: 'the last words of the Babylonian XPa, verbatim; as a blessing at parting (C)' },
  { id: 'bab.pious.ina_silli', lang: 'bab', intent: 'pious', words: ['bab:ina', 'bab:ṣilli', 'bab:ša', 'bab:Aḫuramazdaʾ'],
    gloss: 'Under the protection of Ahuramazda.', phraseTier: 'B', usageTier: 'C', src: 'XPc Babylonian (ARIo Q007211): i-na ṣi-il-li ša₂ {d}a-hu-ur-ma-az-da-ʾ',
    note: "XPc verbatim except that the god's name is spelled as in XPa (a-hu-ru-); the Babylonian of \"by the favour of Ahuramazda\"" },
  { id: 'bab.pious.ilu_rabu', lang: 'bab', intent: 'pious', words: ['bab:ilu', 'bab:rabû', 'bab:Aḫuramazdaʾ'],
    gloss: 'A great god is Ahuramazda.', phraseTier: 'B', usageTier: 'C', src: 'XPc Babylonian 1 (ARIo Q007211): DINGIR ra-bu-u₂ {d}a-hu-ur-ma-az-da-ʾ',
    note: 'opening of the Babylonian XPc; ilu is the reading of the logogram DINGIR (B)' },
  { id: 'bab.remark.babbanu', lang: 'bab', intent: 'remark', words: ['bab:babbanû'], roles: ['mason', 'scribe'],
    gloss: 'Fine! (good, beautiful)', phraseTier: 'C', usageTier: 'C', src: 'XPa, XPf Babylonian (ARIo): bab-ba-nu-u₂', note: 'the Late Babylonian word for "good work" said of a finished block (C)' },
  { id: 'bab.refuse.la', lang: 'bab', intent: 'refuse', words: ['bab:lā'],
    gloss: 'No. (lit. "not")', phraseTier: 'C', usageTier: 'C', src: 'Cyrus Cylinder (ARIo Q006653): la', note: 'the negation alone (C)' },
  { id: 'bab.count.isten', lang: 'bab', intent: 'count', words: ['bab:išten'], roles: ['scribe', 'mason', 'porter'],
    gloss: 'One.', phraseTier: 'C', usageTier: 'C', src: 'XPa Babylonian (ARIo Q007209): iš-ten', note: 'the only number written out in the texts read; others are numerals' },
  { id: 'bab.ration.kurummatu', lang: 'bab', intent: 'ration', words: ['bab:kurummatu'], roles: ['scribe', 'official'],
    gloss: 'Rations.', phraseTier: 'C', usageTier: 'C', src: 'LB letter (ORACC CAMS P348888): KURUM₆.HI.A', note: 'the LB word for food allocations, read from a logogram (B word, C usage)' },
  { id: 'bab.offer.akalu', lang: 'bab', intent: 'offer', words: ['bab:akalu'], roles: ['baker', 'grinder'],
    gloss: 'Bread.', phraseTier: 'C', usageTier: 'C', src: 'RIBo (ORACC Q005471): NINDA', note: 'reading of the logogram NINDA (B); offering bread (C)' },
  // ---------------- Greek (5th-c. Ionic): Herodotus' Ionic prose, one Homeric greeting (D-106)
  { id: 'grc.greet.khaire_xeine', lang: 'grc', intent: 'greet', words: ['grc:khaire', 'grc:xeine'],
    gloss: 'Greetings, stranger.', phraseTier: 'A', usageTier: 'C', src: 'Hom. Od. 1.123: χαῖρε, ξεῖνε', note: 'verbatim in Ionic epic; greeting a stranger in 467 (C)' },
  { id: 'grc.greet.khaire', lang: 'grc', intent: 'greet', words: ['grc:khaire'],
    gloss: 'Greetings.', phraseTier: 'C', usageTier: 'C', src: 'lexicon grc:khaire', note: 'the common Greek greeting (C for 5th-c. Ionic speech)' },
  { id: 'grc.reply.khaire', lang: 'grc', intent: 'reply', words: ['grc:khaire'],
    gloss: 'Greetings.', phraseTier: 'C', usageTier: 'C', src: 'lexicon grc:khaire', note: 'returning the greeting (C)' },
  { id: 'grc.reply.ouk_oida', lang: 'grc', intent: 'reply', words: ['grc:ouk', 'grc:oida'],
    gloss: "I don't know.", phraseTier: 'A', usageTier: 'C', src: 'Hdt 4.195.2: οὐκ οἶδα', note: 'verbatim in Herodotus; a worker who does not follow the stranger (C)' },
  { id: 'grc.reply.tharsee', lang: 'grc', intent: 'reply', words: ['grc:tharsee'],
    gloss: 'Take heart!', phraseTier: 'C', usageTier: 'C', src: 'Hdt 1.9.1: θάρσεε', note: 'reassurance (C)' },
  { id: 'grc.affirm.nai', lang: 'grc', intent: 'affirm', words: ['grc:nai'],
    gloss: 'Yes.', phraseTier: 'C', usageTier: 'C', src: 'Hdt 1.159.4: ναὶ κελεύω', note: 'the particle alone as an answer (C)' },
  { id: 'grc.farewell.ithi_khairon', lang: 'grc', intent: 'farewell', words: ['grc:ithi', 'grc:khairōn'],
    gloss: 'Go, and fare well.', phraseTier: 'A', usageTier: 'C', src: 'Hdt 1.121.1: ἴθι χαίρων', note: 'Astyages to Cyrus, verbatim; as a leave-taking (C)' },
  { id: 'grc.pious.o_zeu', lang: 'grc', intent: 'pious', words: ['grc:ō', 'grc:Zeu'],
    gloss: 'O Zeus!', phraseTier: 'A', usageTier: 'C', src: 'Hdt 5.105.2, 7.56.2: ὦ Ζεῦ', note: 'the exclamation, verbatim (C for use on the Terrace)' },
  { id: 'grc.refuse.ou', lang: 'grc', intent: 'refuse', words: ['grc:ou'],
    gloss: 'No.', phraseTier: 'C', usageTier: 'C', src: 'lexicon grc:ou', note: 'the negation alone (C)' },
  { id: 'grc.call_workers.age', lang: 'grc', intent: 'call_workers', words: ['grc:age'], roles: ['mason', 'foreman'],
    gloss: 'Come on!', phraseTier: 'C', usageTier: 'C', src: 'Hdt 7.103.1: ἄγε', note: 'urging the gang at a lift (C)' },
  { id: 'grc.call_workers.phere', lang: 'grc', intent: 'call_workers', words: ['grc:phere'], roles: ['mason'],
    gloss: 'Come now!', phraseTier: 'C', usageTier: 'C', src: 'Hdt 1.11.4, 1.97.3: φέρε', note: 'hortatory "come" (lit. "bring") (C)' },
  { id: 'grc.count.eis_duo_treis', lang: 'grc', intent: 'count', words: ['grc:eis', 'grc:duo', 'grc:treis'], intonation: 'level', roles: ['mason', 'porter', 'scribe'],
    gloss: 'One, two, three.', phraseTier: 'C', usageTier: 'C', src: 'Hdt 1.38.2, 1.7.4, 1.60.4', note: 'counting aloud (C)' },
  { id: 'grc.remark.kalos', lang: 'grc', intent: 'remark', words: ['grc:kalōs'], roles: ['mason'],
    gloss: 'Well (done).', phraseTier: 'C', usageTier: 'C', src: 'Hdt 1.32.5: καλῶς', note: 'said of a finished surface (C)' },
  { id: 'grc.ration.dos_moi_sitia', lang: 'grc', intent: 'ration', words: ['grc:dos', 'grc:moi', 'grc:sitia'], roles: ['mason', 'porter'],
    gloss: 'Give me (my) provisions.', phraseTier: 'C', usageTier: 'C', src: 'Hdt 3.140.5 "μοι δὸς"; σιτία Hdt 1.94.4', note: 'composed; the ration queue (C)' },
  { id: 'grc.offer.artos', lang: 'grc', intent: 'offer', words: ['grc:artos'], roles: ['baker', 'grinder'],
    gloss: 'Bread.', phraseTier: 'C', usageTier: 'C', src: 'Hdt 8.137.3: ἄρτος', note: 'offering or naming bread (C)' },
  { id: 'grc.identify.iones', lang: 'grc', intent: 'identify', words: ['grc:Iōnes'], roles: ['mason'],
    gloss: '(We are) Ionians.', phraseTier: 'C', usageTier: 'C', src: 'Hdt 1.28.1: Ἴωνες', note: 'the stone-cutters of DSf were "Yaunā and Sardians"; self-identification (C)' },
];

/**
 * Lines that were wanted but omitted because the lexicon lacks a word or form. Mirrored in research/OPEN_QUESTIONS.md.
 * Nothing here is ever voiced.
 */
export const LEXICON_GAPS: { lang: LangId | string; wanted: string; missing: string; q: string }[] = [
  { lang: 'op', wanted: 'greeting / reply / thanks / yes', missing: 'no everyday formula is attested in Old Persian (lexicon records the absence); "true" (hašiyam) and "not" (nai̯) stand in', q: 'Q-022' },
  { lang: 'op', wanted: 'water, bread, come, give; numbers above one', missing: 'water only as loc. apiyā (DB, Q-130); no bread word; only ai̯va- "one" is written out', q: 'Q-022' },
  { lang: 'op', wanted: 'ṛštika ami "I am a spearman" (DNb)', missing: 'the verb form ami "I am" has no lexicon entry', q: 'Q-022' },
  { lang: 'el', wanted: 'greeting / reply / yes', missing: 'no entries; the PF letters open "(To) PN say, PN speaks" (tiriš … nanri), not with a greeting', q: 'Q-023' },
  { lang: 'el', wanted: 'zaumin Uramasdana "by the favour of Ahuramazda"', missing: 'genitive Uramasda-na (attested XPa El) has no lexicon entry', q: 'Q-023' },
  { lang: 'el', wanted: 'barley / flour / wine / beer / wheat ration talk', missing: 'ŠE.BAR, ZÍD.DA, GEŠTIN, KAŠ, ŠE.GIG, QA are logograms without an Elamite reading (ipa "–")', q: 'Q-023' },
  { lang: 'arc', wanted: 'ʾlhyʾ yšʾlw šlmk "may the gods seek after your welfare" (letter blessing)', missing: 'ʾlhyʾ (emph. pl.), yšʾlw (impf. 3 m.pl. of šʾl), šlmk (šlm + 2 m.sg. suffix)', q: 'Q-024' },
  { lang: 'arc', wanted: 'šlm mrʾy "greetings, my lord"', missing: 'mrʾy (1 sg. suffix) has no entry/IPA', q: 'Q-024' },
  { lang: 'arc', wanted: 'thank you; a plain "yes"; water', missing: 'no entries (yṣybʾ "certainly" is Daniel only; myn "water" is tier C, not seen)', q: 'Q-024' },
  { lang: 'bab', wanted: 'spoken greeting; yes; numbers above one; a work call', missing: 'letters give only the written šulmu formula; only išten "one" is written out; dullu "work" was not found in the texts read', q: 'Q-134' },
  { lang: 'grc', wanted: 'thank you; a greeting attested in Herodotus', missing: 'χαῖρε is Homeric (not in Herodotus); no "thanks" formula collected', q: 'Q-135' },
  { lang: 'Egyptian, Lydian', wanted: 'any line', missing: 'no lexicon for these languages; their speakers answer with gesture (or Aramaic if the sim lists it)', q: 'Q-025' },
];

export interface ResolvedLine extends SpeakableLine {
  def: LineDef; entries: LexEntry[];
  tier: 'A' | 'B' | 'C';
  tierParts: { words: 'A' | 'B' | 'C'; phrase: 'A' | 'B' | 'C'; ipa: 'A' | 'B' | 'C'; usage: 'B' | 'C' };
}

/** Resolve a line against the lexicon; throws if a word is missing, from another language, or has no IPA. */
export function resolveLine(def: LineDef): ResolvedLine {
  const entries = def.words.map(id => {
    const e = lexEntry(id);
    if (!e) throw new Error(`speech line ${def.id}: "${id}" is not a lexicon entry`);
    if (e.lang !== def.lang) throw new Error(`speech line ${def.id}: "${id}" is ${e.lang}, line is ${def.lang}`);
    if (!isSpeakable(e)) throw new Error(`speech line ${def.id}: "${id}" has no speakable IPA`);
    return e;
  });
  const words = worstTier(...entries.map(e => e.tier)), ipa = worstTier(...entries.map(e => e.tierIpa));
  return {
    id: def.id, lang: def.lang, intonation: def.intonation, def, entries,
    ipa: entries.map(e => e.ipa!).join(' '),
    translit: entries.map(citationForm).join(' '),
    gloss: def.gloss,
    tier: worstTier(words, def.phraseTier, ipa, def.usageTier),
    tierParts: { words, phrase: def.phraseTier, ipa, usage: def.usageTier },
  };
}

export const LINES: ResolvedLine[] = LINE_DEFS.map(resolveLine);
export const LINE_BY_ID = new Map(LINES.map(l => [l.id, l]));

/**
 * Sim language labels (Agent.langs) that may speak scripted lines. Only languages with a lexicon; everyone else (Egyptian,
 * Lydian) answers with gesture. 'Iranian' (the sim's label for Persians named from the Iranian pool) is voiced as Old
 * Persian (C). The sim lists Aramaic first for its Babylonians, so they speak Babylonian only where Aramaic has no line.
 */
export const SPEECH_LANGS: Record<string, { lang: LangId; tier: 'B' | 'C'; note: string }> = {
  'Old Persian': { lang: 'op', tier: 'C', note: 'lexicon IPA reconstructed' },
  Iranian: { lang: 'op', tier: 'C', note: 'unspecified Iranian speaker given Old Persian lines' },
  Elamite: { lang: 'el', tier: 'C', note: 'lexicon IPA reconstructed' },
  Aramaic: { lang: 'arc', tier: 'C', note: 'lexicon IPA reconstructed' },
  Babylonian: { lang: 'bab', tier: 'C', note: 'Late Babylonian lexicon; IPA reconstructed; whether Akkadian was still spoken in 467 is itself uncertain (Q-134)' },
  Greek: { lang: 'grc', tier: 'C', note: 'Ionic Greek lexicon (Herodotus); IPA reconstructed' },
};

/**
 * Pick a line for a speaker: tries the speaker's languages in order (code-switching: a Persian who also speaks Aramaic
 * greets in Aramaic, since Old Persian has no attested greeting). Returns null when nothing fits: the NPC responds with
 * gesture only. Deterministic for a given seed.
 */
export function pickLine(q: { langs: readonly string[]; intent: Intent; role?: string; seed?: number }): { line: ResolvedLine; via: string } | null {
  const rng = new Rng(q.seed ?? 1, `line:${q.intent}`);
  for (const label of q.langs) {
    const m = SPEECH_LANGS[label]; if (!m) continue;
    const cands = LINES.filter(l => l.lang === m.lang && l.def.intent === q.intent && (!l.def.roles || (q.role != null && l.def.roles.includes(q.role))));
    if (cands.length) return { line: rng.pick(cands), via: label };
  }
  return null;
}

/**
 * Deterministic voice for a person. The sim has no ages yet: adults 20–55 by seed, children (role 'child') 8. Tier C.
 */
export function voiceFor(p: { seed: number; sex: 'm' | 'f'; role?: string; age?: number }): VoiceParams {
  const r = new Rng(p.seed >>> 0, 'voice');
  const age = p.age ?? (p.role === 'child' ? 6 + r.int(0, 5) : 20 + r.int(0, 35));
  return { sex: p.sex, age, pitch: 0.9 + r.next() * 0.2, rate: 0.92 + r.next() * 0.16, breath: r.next() * 0.05, seed: hashString(`voice:${p.seed}`) };
}

/** the pre-rendered voice class for a speaker (tools/build_speech.py: m1 man low, m2 man mid, m3 old man, f1 woman,
 *  f2 older woman, c1 child); deterministic from the voice parameters (C) */
export function voiceKeyFor(v: VoiceParams): 'm1' | 'm2' | 'm3' | 'f1' | 'f2' | 'c1' {
  if (v.age < 14) return 'c1';
  if (v.sex === 'f') return v.age >= 45 ? 'f2' : 'f1';
  if (v.age >= 50) return 'm3';
  return v.pitch < 1.0 ? 'm1' : 'm2';
}
