CINDER 07 — ICE COMBAT TRAINING

PLAY
https://sunnuythemeproject.vercel.app
Desktop: PLAY MASSIVE ICE SLAM.html (standalone, no server required).

CONTROLS
WASD / arrows: auto sprint and strafe. Space: jump.
Q: forward dash with a leaning R6 animation (1.25s cooldown).
Left-click: right / left / right / left punch combo. Every punch steps forward.
Lock-on starts enabled: the camera stays fixed on the dummy and ignores
mouse motion, right-drag and scroll. The cursor is captured and hidden
automatically. Shift toggles lock-on. With lock-on off, right-drag and the
wheel adjust the free camera. Escape pauses and releases the cursor;
click Return to arena or press Enter to resume. R: reset.
C: forward ice stomp (5s cooldown). V: massive ground slam (10s cooldown).
Z / X remain individual punch shortcuts and share the punch recovery gate.

DUMMY, DASH AND FINISHER
The dummy has 100 health. A punch deals 25 damage on a connected hit;
misses do not hurt it. Punches advance up to 0.7 world units and stop against
the dummy or a wall. Q moves up to 5.5 units in 0.28s using swept collision.
C deals 25 damage in its forward range. V deals 50 inside the ice field.

A lethal punch starts a five-second finisher using the earlier hand-clash
scene from Roblox_Hand_Clash_ThreeJS. Its 16 authored R6 poses are retargeted
to the ice character and dummy, smoothly interpolated, and keep both moving
hand contacts. The same neutral wind effects play at clash and recoil.
The ice character breaks the struggle, releases an ice blast, and freezes
the victim inside a crystal shell. The statue remains for eight seconds,
then the dummy respawns. R can reset the target and cinematic at any time.
No blood, dragon, reference-video playback or background lettering is used.

COMBO AND COOLDOWNS
Each click requests one hit. Four quick clicks are buffered; holding the
mouse does not auto-attack. A completed combo has a 0.7-second cooldown.
A one-second pause after an unfinished combo resets its next hit to right.
Z / X individual punches use the same 0.7-second recovery gate.
C and V cooldowns count from activation and are independent. Attacks, dash
and the finishing scene do not overlap. Reset clears all queued actions.

MAP AND MOVEMENT
A clear 112-by-112-unit training area has four solid walls and no fixed
obstacles on the playable floor. The original foundry assets are retained.
Movement uses Pure_Sprint_Animation.blend, immediate speed changes, air
steering, 120ms coyote time and jump buffering, and smooth quick turns.
The left punch lasts 0.60s and the right cross 0.75s, with a full 90-degree
body turn and full arm extension. Seven ice crystals follow each hand bone.
Lock-on keeps the fixed camera preset during ice abilities; the finisher
uses a cinematic view.

SOURCE AND VALIDATION
npm ci
npm run build
npm test
npm run test:combat
npm run test:punches
npm run test:movement
npm run test:lockon
Set GAME_TEST_BROWSER to a Chromium executable if necessary.

source/game.js: controls, collision, target camera, damage and combat state.
source/training-dummy.js: R6 target, health, recoil and ice shell.
source/combat-poses.js: rigid R6 dash and finishing poses.
source/finisher.js: hand-clash retargeting, cinematic and freezing ice blast.
source/finisher-motion.json: the previously authored hand-clash pose data.
source/hand-clash-vfx.js: neutral clash/recoil wind effects from that scene.
source/punches.js and source/ice-fists.js: punches and hand-mounted crystals.
source/open-arena.js: the open map and perimeter collision.
source/build.mjs embeds the source and dist/assets JSON into standalone HTML.
Local builds update Desktop play files. Vercel builds the static dist/ site.

BLENDER FILES
Desktop/R6 Power Punches/R6_Power_Punches.blend: both editable punch actions.
Desktop/Ice_Slam_CE1_Ground_Ring.blend: editable V animation and ice VFX.
