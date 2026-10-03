# C13 (D-780) asks to other owners: the court's programme is simulated; these make it read on screen

The plans already carry the words below (src/people/court.ts); each ask is the performance or the hook that shows them.

## C8 (src/people/activities.ts): variants keyed to the court's words
Paste into the `variants` of the activity named (regexes match court.ts `why` text exactly):
```ts
// walk:
{ when: /on horseback/, anim: 'ride', sound: undefined, animals: { kind: 'mount', species: ['horse_saddle'], pace: 1.8 }, note: 'riding with the king, to the hunt or at exercise: a saddle cloth, no stirrups (blocklist; Cyr. 8.3, 1.4: claims, B; C: D-780)' },
{ when: /leading the king’s horses|leading the horses back/, animals: { kind: 'string', species: ['horse_saddle', 'horse_saddle', 'horse_saddle'], n: 3, pace: 1.0 }, note: 'a groom leading the king’s saddled horses (C: D-780)' },
{ when: /leading the gift animals/, animals: { kind: 'string', species: ['horse'], n: 2, pace: 0.9 }, note: 'a delegate leading his people’s gift animals up to the king (the Apadana reliefs, B; the species by delegation: court.ts partyAnimals; C: D-780)' },
// tend_animals:
{ when: /horse/, animals: { kind: 'beside', species: ['horse'] }, note: 'seeing to a horse (POTTS2023: horse rations, B; C)' },
// inspect:
{ when: /bowing low before the king|right hand raised before (his|the) mouth/, anim: <a bow: torso pitched ~35°, right forearm raised, the hand before the mouth>, note: 'proskynesis (the Treasury relief, B; HDT 1.134, B claim; C: D-780)' },
{ when: /pouring wine at the tables|serving at the tables/, prop: 'jar', note: 'serving at the king’s banquet (C: D-780)' },
{ when: /by the lamp stands/, note: 'tending the lamps at the banquet (C: D-780)' },
// eat:
{ when: /at the king’s banquet/, anim: 'sit', prop: 'bowl', note: 'seated at a low table at the king’s banquet, eating and drinking (Heracleides in Athenaeus 4.145: a claim, B; C: D-780)' },
// patrol:
{ when: /beating the reeds/, prop: 'stick', note: 'a beater driving the game toward the riders (C: D-780)' },
```
The bow needs a pose (anim.ts / workAnims.ts; poseKit is C5's): a held bow at the waist with the right hand at the mouth.

## C1 (src/people/calendar.ts): one line, the programme in the event log
After the court block (`if (this.court) { ... }`), so the chronicle and the soak see the ceremonies:
```ts
if (this.court && pop.court) for (const e of pop.court.programme(d)) if (!['guard_change', 'exercise', 'courier', 'dawn_rite'].includes(e.kind)) E(e.t0, e.kind === 'gift_day' || e.kind === 'audience' ? 'E-24' : e.kind === 'birthday' ? 'E-35' : e.kind === 'king_gifts' ? 'E-36' : 'E-27', e.note, e.place);
```
(E-24/E-35/E-36 rows in events_calendar.json now say court_programme; tests/population.test.ts still holds them absent without the court.)

## C9 (src/world/fauna.ts, people/animals.ts gait): the gallop
Couriers ride at 7.5 m/s and the hunt at ~5 m/s (court.ts `ride`); the mount's gait is the walk. A gallop cycle for `horse_saddle`
above ~3 m/s, and the royal chariot (fauna.ts:182, parked) driven when the king rides (`CourtResidents.kingOut(d)`).

## C4 (src/world/fire.ts, firePlaces.ts): the Apadana's lamps lit on banquet nights
`isBanquetNight(seed, d)` (people/ceremony.ts) is true on the nights of great banquets; the lamp stands are in
furnish_palaces.ts (state 'use', building 'apadana', kind 'lamp_stand'). Light them from the banquet's start
(`ceremonyHours(seed, d).banquet`) to its end.

## audio (performers.ts, unowned: the lead): music at the banquet and with the column
A 'court_banquet' gig in the Apadana on `isBanquetNight` from `ceremonyHours(...).banquet[0]` (harps, pipes, frame drums, singers:
Parmenion's musicians, ATH13-PARM, B claim), and drums and trumpets with the delegations on `isGiftDay` from `ceremonyHours(...).gift0`.

## C5 (src/people/popview.ts): the daily wardrobe on the look
`lookInput` does not pass the wardrobe's `outfit` (wardrobe/world.ts outfitAt) to looks.ts: the dyes of the day's chosen garments
are never seen. Passing it now shows dyed garments (garments.ts DYE_BY_WEALTH was brightened with D-780).
