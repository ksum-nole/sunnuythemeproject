CINDER 07 — OPEN TRAINING ARENA

PLAY
Open https://sunnuythemeproject.vercel.app or double-click
PLAY MASSIVE ICE SLAM.html on the Desktop. The Desktop copy is standalone.

CONTROLS
WASD / arrows: auto sprint. Space: jump. Shift: toggle shift lock.
Left-click: four-hit punch combo, right / left / right / left.
Right mouse + drag: orbit. In shift lock, move the mouse freely to look.
Mouse wheel: zoom. Escape: release the mouse. R: reset the arena spawn.
C: forward ice stomp. V: massive ground-punch ice slam.
Z / X remain individual punch shortcuts and share the punch recovery gate.

COMBO AND COOLDOWNS
Each left-click requests one punch. Up to four clicks are buffered, so quick
clicks continue the sequence without being dropped. Holding the mouse does
not auto-attack. A finished four-hit combo has a 0.7-second cooldown.
After an unfinished combo, a one-second pause resets the next hit to right.
Individual Z / X punches have the same 0.7-second recovery and cannot bypass
combo cooldown. Reset clears queued punches and cooldowns.

C cooldown: 5 seconds from activation.
V cooldown: 10 seconds from activation.
The ice abilities have independent cooldowns and share the animation lock.
On-screen indicators show the combo step, next hand, and remaining cooldowns.

OPEN MAP
A clear 112-by-112 world-unit training area replaces the foundry structures
for now. Four solid walls enclose the floor. All decorative details sit at
the perimeter. The old foundry source assets remain in dist/assets.

MOVEMENT AND PUNCHES
The run uses Pure_Sprint_Animation.blend at the original sprint cadence.
Movement starts and stops immediately, with camera-relative air steering,
120ms coyote time and jump buffering, and fast smooth character turns.
Left punch: 0.60s. Right cross: 0.75s. Torso, hips, feet and cape complete a
full 90-degree turn. The striking arm stays straight at full extension.
Seven faceted ice crystals follow each original fist bone through every move.

ICE AND BLENDER
V uses the Place1.rbxl animation with a readable 2.0-second startup and the
original three-frame downstrike. A grounded 85.6-stud ice circle is surrounded
by 160 spikes. Camera zoom stays under manual control during both abilities.
Desktop/Ice_Slam_CE1_Ground_Ring.blend contains the editable V animation/VFX.
Desktop/R6 Power Punches/R6_Power_Punches.blend contains the two punch actions.

DEVELOPMENT
npm ci
npm run build
npm test
node source/test-punches.mjs
node source/test-movement.mjs
Set GAME_TEST_BROWSER to a Chromium executable when necessary.

source/game.js: gameplay, combo input, cooldowns, camera and collision.
source/open-arena.js: open arena and perimeter collision.
source/punches.js: both punch animations.
source/ice-fists.js: bone-attached crystal fist meshes.
source/build.mjs: standalone browser build; updates local Desktop play files.
The JSON files in dist/assets are required build inputs. vercel.json builds
the static dist/ site; Vercel builds skip local Desktop-file copies.
