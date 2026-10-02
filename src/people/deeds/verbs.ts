// D-459 (UD-32): the sense of each deed. For every verb: whether the other must be willing (consent), how an ordinary person
// takes being asked (want: -1 hateful .. 1 welcome), what it costs them (hours from their own day), whether it is a wrong
// (the law's word for it, A/B where the Achaemenid evidence names it, else C), and the words that propose it (the lexicon:
// the translation layer's English; the model's JSON names the verb directly). Activities are the catalogue's
// (activities.ts): words for shared work and pastimes map onto the performed activity nearest them (tier C where the catalogue
// has no exact one: a dance is performed as 'play', a drink as 'eat', a hunt as 'fowl' in the hills; listed in NEAR_ACT).
import type { ActivityId } from '../activities';
import type { Verb, Good } from './types';

export interface VerbSense {
  /** the other's willingness decides it (else the deed is done to them: a blow, a theft, an insult) */
  consent: boolean;
  /** how an ordinary person takes it, -1..1, before feelings, temper and circumstance */
  want: number;
  /** hours of the other's day it takes (0: a moment) */
  hours: number;
  /** a wrong the law and the neighbours take up (the crime's word) */
  wrong?: string;
  /** what it does to the other's feelings toward the doer when done (scaled by force and outcome) */
  feel?: Partial<Record<'aff' | 'anger' | 'fear' | 'grat' | 'resp', number>>;
  /** the gloss for the brief (what the other is being asked or what is done to them) */
  gloss: string;
}

export const VERBS: Record<Verb, VerbSense> = {
  join: { consent: true, want: 0.1, hours: 1.5, feel: { aff: 0.06, resp: 0.01 }, gloss: 'to do something together' },
  help: { consent: true, want: 0.45, hours: 1.5, feel: { aff: 0.06, grat: 0.12, resp: 0.03 }, gloss: 'help with their work' },
  teach: { consent: true, want: -0.05, hours: 1, feel: { aff: 0.03, resp: 0.02 }, gloss: 'to teach the stranger their skill' },
  learn: { consent: true, want: 0.15, hours: 1, feel: { aff: 0.03, resp: 0.04 }, gloss: 'to be taught something by the stranger' },
  hire: { consent: true, want: 0.2, hours: 4, feel: { resp: 0.03 }, gloss: 'to work for pay' },
  give: { consent: true, want: 0.6, hours: 0, feel: { aff: 0.06, grat: 0.12 }, gloss: 'to accept a gift' },
  lend: { consent: true, want: 0.5, hours: 0, feel: { grat: 0.1 }, gloss: 'to take a loan, to be repaid' },
  borrow: { consent: true, want: -0.3, hours: 0, feel: { resp: -0.02 }, gloss: 'to lend something to the stranger' },
  ask_for: { consent: true, want: -0.25, hours: 0, feel: { resp: -0.03 }, gloss: 'to give something away for nothing' },
  steal: { consent: false, want: -1, hours: 0, wrong: 'theft', feel: { anger: 0.6, aff: -0.4, fear: 0.1 }, gloss: 'a theft' },
  return: { consent: false, want: 0.5, hours: 0, feel: { grat: 0.05, anger: -0.2, resp: 0.05 }, gloss: 'something returned' },
  share_food: { consent: true, want: 0.35, hours: 0.6, feel: { aff: 0.08, grat: 0.05 }, gloss: 'to eat together' },
  tell: { consent: false, want: 0.1, hours: 0, gloss: 'news told' },
  lie: { consent: false, want: 0.1, hours: 0, gloss: 'news told (false)' },
  promise: { consent: false, want: 0.25, hours: 0, feel: { aff: 0.02 }, gloss: 'a promise' },
  threaten: { consent: false, want: -0.7, hours: 0, wrong: 'threats', feel: { fear: 0.35, anger: 0.3, aff: -0.25 }, gloss: 'a threat' },
  warn: { consent: false, want: 0.2, hours: 0, feel: { grat: 0.05, fear: 0.05 }, gloss: 'a warning' },
  apologize: { consent: false, want: 0.3, hours: 0, feel: { anger: -0.25, aff: 0.04 }, gloss: 'an apology' },
  thank: { consent: false, want: 0.3, hours: 0, feel: { aff: 0.04, resp: 0.02 }, gloss: 'thanks' },
  praise: { consent: false, want: 0.35, hours: 0, feel: { aff: 0.05, resp: 0.01 }, gloss: 'praise' },
  insult: { consent: false, want: -0.6, hours: 0, wrong: 'insult', feel: { anger: 0.35, aff: -0.2, resp: -0.05 }, gloss: 'an insult' },
  mock: { consent: false, want: -0.45, hours: 0, feel: { anger: 0.2, aff: -0.12 }, gloss: 'mockery' },
  curse: { consent: false, want: -0.8, hours: 0, wrong: 'cursing', feel: { fear: 0.25, anger: 0.35, aff: -0.3 }, gloss: 'a curse' },
  comfort: { consent: false, want: 0.4, hours: 0.3, feel: { aff: 0.08, grat: 0.06 }, gloss: 'comfort' },
  confide: { consent: false, want: 0.15, hours: 0.3, feel: { aff: 0.05, resp: 0.01 }, gloss: 'a confidence' },
  flirt: { consent: false, want: 0, hours: 0, feel: { aff: 0.03 }, gloss: 'flirting' },
  court: { consent: true, want: -0.1, hours: 0.5, gloss: 'to be courted' },
  bless: { consent: false, want: 0.35, hours: 0, feel: { aff: 0.04, resp: 0.03 }, gloss: 'a blessing' },
  forgive: { consent: false, want: 0.3, hours: 0, feel: { aff: 0.05, grat: 0.05 }, gloss: 'forgiveness' },
  accuse: { consent: false, want: -0.5, hours: 0, feel: { anger: 0.3, aff: -0.15 }, gloss: 'an accusation' },
  complain: { consent: false, want: -0.05, hours: 0, gloss: 'a complaint about someone' },
  intercede: { consent: true, want: -0.1, hours: 0.5, gloss: 'to plead for someone' },
  reconcile: { consent: true, want: 0.05, hours: 0.5, gloss: 'to make peace with someone' },
  introduce: { consent: true, want: 0.15, hours: 0.2, gloss: 'to meet someone' },
  attack: { consent: false, want: -1, hours: 0, wrong: 'assault', feel: { anger: 0.6, fear: 0.5, aff: -0.6, resp: -0.1 }, gloss: 'a blow' },
  push: { consent: false, want: -0.6, hours: 0, wrong: 'assault', feel: { anger: 0.35, fear: 0.15, aff: -0.25 }, gloss: 'a shove' },
  embrace: { consent: true, want: -0.1, hours: 0, feel: { aff: 0.06 }, gloss: 'an embrace' },
  heal: { consent: true, want: 0.5, hours: 0.5, feel: { grat: 0.2, aff: 0.08, resp: 0.05 }, gloss: 'to have a wound or a sickness tended' },
  carry: { consent: true, want: 0.45, hours: 0.5, feel: { grat: 0.08, aff: 0.03 }, gloss: 'to have a load carried for them' },
  fetch: { consent: true, want: -0.15, hours: 0.6, gloss: 'to fetch something or someone' },
  repair: { consent: true, want: 0.45, hours: 2, feel: { grat: 0.12, aff: 0.04, resp: 0.04 }, gloss: 'to have something of theirs mended' },
  build: { consent: true, want: 0.3, hours: 3, feel: { grat: 0.1, resp: 0.05 }, gloss: 'to build something together' },
  break: { consent: false, want: -0.9, hours: 0, wrong: 'damage', feel: { anger: 0.5, aff: -0.35 }, gloss: 'damage to their things' },
  guard: { consent: true, want: 0.3, hours: 2, feel: { grat: 0.08, resp: 0.04 }, gloss: 'to have someone keep watch for them' },
  come_with: { consent: true, want: -0.1, hours: 1, gloss: 'to go somewhere with the stranger' },
  visit: { consent: true, want: 0.05, hours: 1, gloss: 'a visit to their house' },
  meet: { consent: true, want: 0, hours: 0.5, gloss: 'to meet again at a place and an hour' },
  send: { consent: true, want: -0.15, hours: 0.6, gloss: 'to carry a message or go on an errand' },
  bring: { consent: true, want: -0.15, hours: 0.6, gloss: 'to bring someone to the stranger' },
  dismiss: { consent: false, want: -0.1, hours: 0, feel: { aff: -0.03 }, gloss: 'being sent away' },
  avoid: { consent: false, want: 0, hours: 0, gloss: 'being kept away from' },
  pray: { consent: true, want: 0.2, hours: 0.5, feel: { aff: 0.03, resp: 0.04 }, gloss: 'to pray together' },
  offer: { consent: true, want: 0.15, hours: 0.6, feel: { resp: 0.05 }, gloss: 'to make an offering together' },
};

/** the words that propose each verb (lower case, the translation layer's English); the first match wins, so the specific go
 *  first. A verb found with an activity word (deeds/parse.ts ACT_WORDS) is the shared work: "help me thresh" is help+thresh */
export const LEXICON: [Verb, RegExp][] = [
  ['steal', /\b(steal|rob|pinch|snatch|swipe|pilfer|make off with|take (it|this|that|them) without)\b/],
  ['attack', /\b(attack|hit|strike|punch|kick|slap|beat|stab|kill|murder|fight|wrestle|thrash|smack|hurt|wound|knock (him|her|you) down|throw a stone at)\b/],
  ['push', /\b(push|shove|trip|grab (him|her|you))\b/],
  ['break', /\b(break|smash|destroy|burn down|set fire to|wreck|tear down|spill|ruin)\b/],
  ['threaten', /\b(threaten|or else|i('ll| will) (kill|hurt|beat|break)|you('ll| will) (regret|pay for)|watch your back)\b/],
  ['curse', /\b(curse|damn|may the gods (strike|punish|curse)|evil eye)\b/],
  ['insult', /\b(insult|you('re| are) (a |an )?(fool|idiot|liar|thief|dog|pig|coward|worthless|ugly|stupid)|fool|idiot|swine|dog of a)\b/],
  ['mock', /\b(mock|laugh at|make fun of|ridicule|tease)\b/],
  ['accuse', /\b(accuse|you stole|(he|she|they) stole|(he|she|they) (is|are) a thief|blame|it was (him|her|you) who)\b/],
  ['complain', /\b(complain|report (him|her|them)|tell the (elder|headman|judge|official|guard|watch) (about|that))\b/],
  ['intercede', /\b(intercede|plead for|speak for|put in a word for|vouch for|stand up for)\b/],
  ['reconcile', /\b(make (it up|peace)|reconcile|be friends again|end (the|your) quarrel)\b/],
  ['introduce', /\b(introduce (me|you)|you should meet|meet my|this is my)\b/],
  ['apologize', /\b(sorry|apologi[sz]e|forgive me|i was wrong|my fault|pardon me)\b/],
  ['forgive', /\b(i forgive|forgiven|no hard feelings)\b/],
  ['thank', /\b(thank|thanks|grateful|i owe you)\b/],
  ['bless', /\b(bless|may the gods (keep|protect|favour|be with)|go in peace)\b/],
  ['praise', /\b(praise|well done|you('re| are) (a )?(good|fine|skilled|kind|wise|brave|beautiful|clever)|beautiful work|fine work|i admire)\b/],
  ['flirt', /\b(flirt|you('re| are) (lovely|pretty|handsome)|your eyes|wink)\b/],
  ['court', /\b(court|marry me|be my wife|be my husband|take you as (my )?wife|ask for (her|his) hand|woo)\b/],
  ['comfort', /\b(comfort|console|don'?t (cry|weep|be afraid)|it will be (all right|well)|i('m| am) sorry for your)\b/],
  ['confide', /\b(confide|a secret|between us|tell no one|i must tell you something)\b/],
  ['warn', /\b(warn|beware|be careful|watch out)\b/],
  ['promise', /\b(promise|swear|i give (you )?my word|vow|on my honou?r)\b/],
  ['lie', /\b(lie to|deceive|trick|pretend (that|to)|tell (him|her|them) a lie)\b/],
  ['tell', /\b(tell (him|her|them|the|your|my|everyone)|let (him|her|them) know|spread the word|pass (it|this|word) on|go and say)\b/],
  ['heal', /\b(heal|tend (your|the|his|her) (wound|cut|leg|arm|fever)|bandage|bind (your|the|his|her) wound|treat (your|the|his|her)|medicine|herbs for)\b/],
  ['repair', /\b(repair|fix|mend|patch|replaster|re-?plaster|rebuild (your|the))\b/],
  ['build', /\b(build|raise a wall|put up a|make a (wall|pen|fence|hut|roof))\b/],
  ['carry', /\b(carry (that|this|it|your|the)|take (that|this) load|let me carry|help you carry|bear (it|the load))\b/],
  ['fetch', /\b(fetch|go get|bring me (some|a|the|water|bread|wine|beer))\b/],
  ['bring', /\b(bring (him|her|them) (to|here)|bring me (your|the) (father|mother|son|daughter|husband|wife|brother|sister|elder|master))\b/],
  ['send', /\b(send (him|her|word|a message)|go and tell|carry (a|my) message|run to)\b/],
  ['guard', /\b(guard|keep watch|stand watch|protect (you|your|him|her))\b/],
  ['embrace', /\b(embrace|hug|hold (you|me)|kiss)\b/],
  ['hire', /\b(i('ll| will) pay you|work for me|i('ll| will) hire|come work for me|be my (servant|guide|porter))\b/],
  ['teach', /\b(teach me|show me how|how do you (make|weave|bake|brew|plough|thresh|spin|fire)|let me learn)\b/],
  ['learn', /\b(let me teach you|i('ll| will) teach you|i can show you how)\b/],
  ['lend', /\b(lend (you|him|her)|take this (and|but) (pay|give) (it )?back|i('ll| will) lend)\b/],
  ['borrow', /\b(borrow|lend me|can i have .{1,20} (until|till)|loan me)\b/],
  ['return', /\b(give (it|this|them) back|return (your|the|this|it)|here is your)\b/],
  ['give', /\b(take this|this is for you|a gift|i give you|have this|accept this)\b/],
  ['ask_for', /\b(give me|can (i|you) have|spare (me )?(some|a)|i need (some|a)|beg)\b/],
  ['share_food', /\b(eat with (me|us|you)|share (my|your|a|the) (bread|meal|food)|break bread|let'?s eat|have a meal)\b/],
  ['pray', /\b(pray|worship)\b/],
  ['offer', /\b(make an offering|offer (to the gods|a sacrifice)|sacrifice)\b/],
  ['visit', /\b(visit (you|your|him|her)|come (to|by) your (house|home)|come to my|call on)\b/],
  ['meet', /\b(meet (me|you|again)|see you (at|by|tomorrow|tonight|later))\b/],
  ['dismiss', /\b(go away|leave me|get out|be gone|off with you|leave us)\b/],
  ['avoid', /\b(keep away from|stay away from|i('ll| will) avoid)\b/],
  ['come_with', /\b(come with me|come along|follow me to|walk with me|go with me|let'?s go( to)?|join me (at|to|on))\b/],
  ['join', /\b(let'?s|shall we|join (me|you|us)|together|with me|with you|go (hunting|fishing|drinking|dancing|swimming))\b/],
  ['help', /\b(help|lend (you )?a hand|assist|i can do that for you|let me do)\b/],
];

/** activity words (the shared work, pastime or errand) -> the catalogue's activity and where it is done (C) */
export const ACT_WORDS: [ActivityId, RegExp, string?][] = [
  ['fowl', /\b(hunt|hunting|snare|trap (birds|game)|partridge|quail|gazelle|game)\b/, 'hills'],
  ['fish', /\b(fish|fishing|catch fish)\b/, 'river'],
  ['eat', /\b(drink|drinking|beer|wine|feast|dine|meal|eat)\b/],
  ['play', /\b(dance|dancing|play|game|knucklebones|race|wrestle for sport)\b/],
  ['gamble', /\b(gamble|dice|bet|wager)\b/],
  ['chant', /\b(sing|song|chant)\b/],
  ['wash', /\b(swim|swimming|bathe|wash)\b/, 'river'],
  ['walk', /\b(walk|stroll)\b/],
  ['mould_brick', /\b(roof|wall|plaster|mud ?brick|bricks?)\b/],
  ['lay_brick', /\b(lay bricks|build a wall)\b/],
  ['work_wood', /\b(door|beam|timber|wood|carpent)\b/],
  ['thresh', /\b(thresh|threshing)\b/], ['reap', /\b(reap|harvest|cut the (barley|wheat|grain))\b/], ['plough', /\b(plough|plow)\b/],
  ['irrigate', /\b(irrigat|water the (field|garden)|open the channel)\b/], ['dig_canal', /\b(dig|ditch|canal)\b/],
  ['field_work', /\b(field|weed|sow)\b/], ['garden_work', /\b(garden|orchard)\b/], ['pick_fruit', /\b(pick (fruit|grapes|dates|figs))\b/],
  ['herd', /\b(herd|flock|sheep|goats)\b/], ['tend_animals', /\b(feed the (animals|donkey|ox|ox(en)?)|stable|muck)\b/], ['milk', /\b(milk)\b/], ['shear', /\b(shear)\b/],
  ['grind', /\b(grind|quern|flour)\b/], ['bake', /\b(bake|bread|oven)\b/], ['cook', /\b(cook|stew|pot on)\b/], ['brew', /\b(brew)\b/],
  ['draw_water', /\b(water|well|draw)\b/], ['gather', /\b(firewood|brushwood|gather|dung)\b/],
  ['weave', /\b(weave|loom)\b/], ['spin', /\b(spin|spindle)\b/], ['craft', /\b(pot|pots|craft|carve|make)\b/], ['smith', /\b(smith|forge|anvil)\b/],
  ['haul', /\b(haul|drag|stone|load)\b/], ['clean', /\b(clean|sweep)\b/], ['tend_fire', /\b(fire|hearth)\b/],
  ['offer', /\b(offering|altar)\b/], ['mourn', /\b(mourn|grieve)\b/], ['bury', /\b(bury|burial|grave)\b/], ['tend_body', /\b(nurse|tend (the|your) (sick|child))\b/],
];
/** the catalogue's nearest performance stands in for a pastime it has none of (C; a render request, not a claim) */
export const NEAR_ACT: Partial<Record<string, string>> = { dance: 'play', drink: 'eat', hunt: 'fowl', swim: 'wash', sing: 'chant', wrestle: 'play' };

export const GOOD_WORDS: [Good, RegExp][] = [
  ['silver', /\b(silver|shekels?|coins?|money|pay)\b/], ['bread', /\b(bread|loaf|loaves)\b/], ['grain', /\b(grain|barley|wheat|flour)\b/], ['beer', /\b(beer)\b/], ['wine', /\b(wine)\b/],
  ['oil', /\b(oil)\b/], ['cloth', /\b(cloth|cloak|tunic|garment|wool)\b/], ['tool', /\b(tool|knife|axe|hoe|sickle|hammer|spindle)\b/], ['animal', /\b(goat|sheep|donkey|ox|cow|chicken|lamb|kid)\b/],
  ['fuel', /\b(fuel|firewood|dung cakes?)\b/], ['water', /\b(water)\b/], ['food', /\b(food|meal|dates|figs|cheese|meat)\b/], ['goods', /\b(pot|jar|basket|bowl|wares|goods)\b/],
];
