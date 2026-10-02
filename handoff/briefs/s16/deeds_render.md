# Render requests for the joint deeds (D-462; for the GPU machine)

The cloud session (node only) made the stranger's and the townspeople's undertakings real in the simulation (src/people/deeds/
joint.ts): the plans now hold a hunt on the hill slopes, fishing at the river bank, an evening's beer at a house, a roof
replastered, a porter or a guide following the stranger, a message carried. Some of these are performed today by the nearest
activity of the catalogue (deeds/verbs.ts NEAR_ACT, tier C stand-ins), and some performances have never been looked at in the
world. Wanted, in one batched job (BATCH=1, the player's lens), then fixes where they read as wrong:

## New performances wanted (activities.ts, anim, props; each its own entry, tier C with the reasoning in its note)
| the deed | performed now as | wanted |
|---|---|---|
| an evening's beer or wine at a house | `eat` (sitting, eating bread) | `drink`: two to four men seated on a mat or the bench by the door, a beer jar with drinking straws or a shared bowl passed hand to hand (the jar and straws: Mesopotamian evidence, B by analogy; C for Pārsa), talk and laughter (sound) |
| a dance (festival, wedding, an evening) | `play` (children hopping) | `dance`: a line or ring of adults, hands linked or on shoulders, stepping in time; a drum or clapping (sound) |
| a hunt with the bow | `fowl` with "bow" in the reason -> `archery` at the reeds | `hunt_bow`: walking the slope with the bow strung and arrows in hand, crouching, a shot; a hare or partridge carried back on a cord |
| wrestling (for sport) | `play` | `wrestle`: two men gripping at the shoulders and belt, a ring of onlookers |
| swimming | `wash` (a basin and a stone) | `swim`: in the river or the canal at the bank, boys and young men in the water to the chest (only `bank:`/`canal:` places) |
| replastering a roof | `mould_brick` (moulding bricks on the ground) | `plaster_roof`: on the flat roof, spreading mud plaster with the hands and a board, a roller stone; a second man handing up the basket of mud from the ground |
| a porter hired by the stranger | `carry_sack` following `@stranger` | check only: the sack on the back while following at 1.5 m; set down when the stranger stops |
| a message carried | `talk` at the third person's door | check only: the walk to the door and a short talk there, then the walk back |

## Places and things to check in the world
- `slope:<q>` (the hills), `bank:<q>` (the river) and `edge:<q>`: two hunters or fishers of one undertaking are placed by
  popgeo each on their own spot; check that friends who went together stand within sight of each other (D-462 lays both at
  the same place name).
- The wound (DeedWorld.injuryOf) on the body: a bandage on the head or arm, a limp for a broken bone (asked by D-459 too).
- A house whose roof leaks (Joint.roofOf < 0.45): a patch of darker, slumped plaster on its roof, a jar set to catch drips
  inside; after the stranger or the neighbours replaster it, fresh pale plaster for a season.

## Done line
Each wanted performance exists (tests/performances.test.ts green), the stand-in in deeds/verbs.ts NEAR_ACT is replaced by it
in deeds/joint.ts (`act` of the job), and one render per performance at the player's lens is in bench-reports/.
