# V6 interior light and fire (D-530..D-539, Q-1460..Q-1469, B560..B569; branch s17-fire)
The player sees, by tonight: rooms lit like a modern AAA interior: daylight entering through doors, smoke holes and
windows with bounce on plaster and floors, dark corners that are dark but readable; hearths, lamps and torches with warm
flicker, soft shadows, smoke-stained ceilings above them; at night the town glows from doors and hearths. Light v1 (V1) is
merged: judge under it. Furnishing is cloud C7's; you own the light and the fire only.
Owns: src/arch/rooms.ts, terrace_rooms.ts (geometry and light), src/world/fire.ts, fireOcc.ts, firePlaces.ts,
src/render/fireGlow.ts. Ask from cloud C3: the court camps' hearths (courtCamps.ts campItems, m === 'hearth') lit at the meal
hours when the court is in residence (a hook in your fire files; courtCamps.ts is C3's).
Probe pages: rooms_probe, house_lab, palace_probe (night and day). Done line: a house room, a palace hall and a night lane in
probe frames read as AAA interior/night light; first pass by ~2.5 h after start, second by ~5 h.
