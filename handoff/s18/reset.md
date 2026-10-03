# s18 reset (lead 3, ~09:50 UTC, after the user: "no excuse for it being so unfinished; what are we doing wrong")

## What we are doing wrong
1. Breadth over finish. 15 agents each add content (stars, wayside wells, tomb inscriptions, estates, a film score) while the
   basics a player meets in the first minute are broken: the live site black for hours, nobody walking in town, roofless
   lanes, black interiors. CLAUDE.md's own rule (UD-19) says a plan whose next step is a detail while the whole reads as CG is
   wrong; the lead (me, today) kept dispatching details.
2. Building blind. The cloud cannot render quality high; the T4 is rarely up; so work is "done" on node tests and crude frames.
   Nobody owns the one thing the player actually runs: the deployed URL.
3. Everyone touches everything. One change (the town belt) broke tests owned by four others; the lead spends the day relaying.
4. No finish line. "Done" was never a list of measured facts, so every round adds more.

## The finish line (the slice, measured in the cloud on every head; nothing else counts until all pass)
A. The deployed URL is lit on the live path (title, Enter, 60 s walk) on WebGL low and WebGPU, no faults (C9 live_path).
B. People move: at every C12 pagecheck town view >= 5 % of in-frustum people walking; popview unresolved routes drain to
   < 200 within 2 game-minutes; Terrace gift-day draws >= 50 % of the people planned within 60 m (C5/C1, C12 measures).
C. The town reads lived-in: open-to-sky cells < 20 % in C6's town views; no interior below mean 40/255 at 10:00 (C2, C4).
D. Faces have no bugs at 0.5 m (beard cards, head roll, torc) (C14).
E. CI green on the head (C7).

## Who works (everyone else finishes their current commit, pushes, reports, and stops)
C9 deploy + live path + load; C4 interiors/night light + render path; C5 + C1 routes/walkers; C2 roofs/walls; C14 face bugs;
C13 banquet hall tables/seats only; C10 paint that reads at 0.6-2 km only; C7 CI; C12 pagecheck each head; C6 renders each head.
Stopped: C3, C8, C11, C15 (their merged work stays).
