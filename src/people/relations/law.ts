// D-346 (ROADMAP 3e): the period's law and custom on courting, marriage, lovers, divorce and parentage, as the relations layer
// uses them. Nothing here is attested for Persepolis: the nearest record is the Neo-Babylonian marriage agreements
// (ROTH1987, search extract only; the clauses below marked RECOLLECTION are NOT SEEN) and Herodotus on Persian households.
// Every rule is tier C at Persepolis; the numbers are reconstructions (RECON) chosen to give plausible rates, logged in
// DECISIONS D-346 and OPEN_QUESTIONS Q-1040..Q-1044.
export interface Rule { id: string; says: string; tier: 'A' | 'B' | 'C'; src: string; note?: string }

export const LAW: Rule[] = [
  { id: 'age', says: 'nobody under 18 takes any part in courting, desire, lovers, intimacy or marriage in this layer', tier: 'C', src: 'the user (s13 brief)',
    note: 'D-348 (closes Q-1040): the whole simulation, the population included, follows it; the period married girls from about 14 (ROTH1987), which stays a documented fact about the period, not simulated' },
  { id: 'agreement', says: 'a marriage is agreed between the groom (or his father) and the bride’s father, mother or brother; the families decide, the pair’s liking weighs', tier: 'C', src: 'ROTH1987 (B for Babylonia)' },
  { id: 'dowry', says: 'the bride brings a dowry from her family’s house into the new household; it stays hers and goes back with her if she is divorced without fault', tier: 'C', src: 'ROTH1987 (B for Babylonia); return on divorce RECOLLECTION, NOT SEEN' },
  { id: 'bridewealth', says: 'the groom’s house gives a gift of silver to the bride’s family at the agreement (rarer than the dowry in the Neo-Babylonian texts)', tier: 'C', src: 'RECOLLECTION, NOT SEEN (Old Babylonian terhatum; Neo-Babylonian biblu)' },
  { id: 'virilocal', says: 'the bride moves to the groom’s household; a divorced or widowed woman goes back to her father’s or brother’s house', tier: 'C', src: 'ROTH1987 (B for Babylonia)' },
  { id: 'divorce_husband', says: 'a husband who sends his wife away pays her the divorce silver (often a mina in the agreements) and returns her dowry', tier: 'C', src: 'RECOLLECTION, NOT SEEN (Neo-Babylonian marriage agreements)' },
  { id: 'divorce_wife', says: 'a wife may leave a husband who has shamed or wronged her; she goes back to her kin, the dowry with her when the fault is his', tier: 'C', src: 'RECON' },
  { id: 'adultery', says: 'a wife found with another man may be sent away without her dowry; the agreements threaten death by the iron dagger, which is never shown or carried out here (punishment as evidence, not spectacle)', tier: 'C', src: 'RECOLLECTION, NOT SEEN (Neo-Babylonian marriage agreements, the “iron dagger” clause)' },
  { id: 'men_lovers', says: 'a married man’s lover shames his house and angers his wife’s kin, but is not in itself grounds for the law', tier: 'C', src: 'RECON (the asymmetry of the Mesopotamian codes, an analogy)' },
  { id: 'parentage', says: 'a child born in a marriage is the husband’s unless he disowns it; doubt is talk, not law, until he sends the mother away', tier: 'C', src: 'RECON' },
  { id: 'remarriage', says: 'widows, widowers and the divorced marry again, arranged as a first marriage but with more say of their own', tier: 'C', src: 'RECON' },
  { id: 'same_sex', says: 'desire between men or between women is lived discreetly; it is never a marriage; found out, it is scandal like any affair', tier: 'C', src: 'RECON (the evidence for Achaemenid Iran is silent; later Avestan law condemns it, not used here)' },
  { id: 'intimacy', says: 'intimacy is a state and a cut-away: never shown, never an interaction; nobody undresses anyone', tier: 'C', src: 'the user (ROADMAP 3e)' },
];

/** the numbers of the custom (all RECON, tier C) */
export const REL = {
  /** the youngest age for any part of this layer (the user) */
  adult: 18,
  /** the ages at which people marry or are married again in this layer (first marriages of the young are the population's) */
  bride: [18, 42] as [number, number], groom: [20, 60] as [number, number],
  /** hours of shared time a week by kind of contact (C) */
  hours: { home: 26, crew: 18, tie: 4, kin: 2.5, neighbour: 1.5, well: 2 } as Record<string, number>,
  /** courting: both desire at least this, affection at least this */
  courtDesire: 0.34, courtAff: 0.1,
  /** an advance to one who does not desire back: the advancer's desire, the other's below which it is a rejection */
  advanceDesire: 0.38, rejectBelow: 0.18, rejectCooldownW: 26,
  /** the families' agreement after this many weeks of courting, when affection and trust are this high */
  betrothWeeks: 5, betrothAff: 0.2, betrothTrust: 0.1, weddingAfter: [28, 70] as [number, number],
  /** affairs: mutual desire, familiarity, and the married one's affection for the spouse below this */
  affairDesire: 0.36, affairFam: 0.25, affairSpouseAff: 0.12, affairP: 0.35,
  /** a week of an affair: discovery by the spouse or the household, and gossip seen by others */
  discoverP: 0.035, gossipP: 0.03,
  /** divorce: a marriage this cold (affection and trust) for this many weeks */
  divorceAff: -0.15, divorceTrust: -0.2, divorceWeeks: 3, divorceP: 0.25,
  /** silver (shekels) of the bride-gift and the dowry, by the house's kind (C) */
  bridewealth: { rich: 60, farmer: 10, craft: 12, herder: 8, ration: 5 } as Record<string, number>,
  dowry: { rich: 120, farmer: 20, craft: 25, herder: 15, ration: 10 } as Record<string, number>,
  divorceSilver: 60,
  /** conception: the chance a cycle of a fertile woman of 20-29 with regular intimacy conceives (C, ~0.2 in natural-fertility
   *  populations); by age; much reduced while she nurses a child under one (lactational amenorrhoea) */
  fecund: 0.2, fecundAge: [[18, 0.85], [20, 1], [30, 0.9], [35, 0.7], [40, 0.4], [44, 0.15], [45, 0]] as [number, number][], nursing: 0.12,
  gestationDays: 266,
  /** news: the chance a week that one who knows tells each contact, by hand; hands past this are not counted */
  tellP: [0.5, 0.3, 0.15] as number[],
};
