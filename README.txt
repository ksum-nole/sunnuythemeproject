CINDER 07 — CE1 GROUND ICE SLAM

PLAY
Double-click PLAY MASSIVE ICE SLAM.html on your Desktop. The complete game is embedded
in that file; no server or internet connection is required.

CONTROLS
WASD / arrows: auto sprint. Shift: toggle shift lock. Space: jump.
Z: left punch. X: right cross.
C: original forward ice burst. V: massive ground ice slam.
Drag: orbit the camera. In shift lock, move the mouse to look and strafe
with A/D while facing the camera direction. Escape releases the mouse.
Mouse wheel: zoom. R: reset.

NEW ANIMATION AND VFX
Source: Desktop/Place1.rbxl, its saved 221-frame R6 KeyframeSequence.
The startup now lasts 2.0 seconds: source frames 0–90 play over frames 0–116.
Source 91 onward remains one-to-one at 60 fps. The final downward slam still
takes its original three frames (0.05s), landing on frame 120.

The ground circle is now 85.6 studs across, four times the preceding diameter
and sixteen times its area. 96 towering outer spikes and 64 inner spikes
surround the field. Outer spikes reach up to 17.3 studs. Ground cracks radiate
from the hand contact. All ice remains at ground level at its base.

The camera keeps your chosen zoom and pitch during both abilities.
Movement and facing stay locked during a cast; cooldown allows recovery.

MOVEMENT
The run uses Pure_Sprint_Animation.blend at its original sprint cadence.
Movement always uses full sprint speed. Character turns quickly through the
shortest angle with a smooth response, including while shift lock is enabled.
Ground movement starts and stops immediately. Air movement supports direct
steering. Coyote time and jump buffering each allow 120 ms of forgiveness.
Solid perimeter walls enclose the arena.

WEB HOSTING
npm ci
npm run build
Serve dist/ as a static website. vercel.json configures the Vercel build.
The JSON files in dist/assets are required build inputs. The HTML bundle is
generated during build. Vercel builds skip the local Desktop play-file copies.

CHECKS
npm test
node source/test-movement.mjs
Set GAME_TEST_BROWSER to a Chromium executable if none is auto-detected.

BLENDER
Desktop/Ice_Slam_CE1_Ground_Ring.blend contains the editable Itrapped skin,
original named R6 bones, retargeted animation, ground circle, 160 spikes,
cracks, camera and studio lighting. Timeline markers identify the downstrike
and impact. Desktop/Ice_Slam_CE1_Preview.png shows the effect after impact.

SOURCE
source/ce1/extract_motion.py: saved Roblox poses through original Motor6Ds.
source/ce1/prepare.py: startup timing and imported skin clip.
source/ce1/build_blender.py: editable Blender scene and browser FX export.
source/game.js: gameplay. source/index.html: HUD. source/build.mjs: offline build.
Run npm run build after browser-code edits; it updates the Desktop play files.

VALIDATION
reviews/ce1/native-validation.json: Blender skin and grounded FX checks.
reviews/ce1/timing.json: source-frame mapping and original-speed downstrike.
reviews/browser-validation.json: movement, V cast, animation, collision,
cooldown, reset, offline loading and browser error checks.

PUNCH ANIMATIONS
Z throws a quick left punch; X throws a heavier right cross. Both are rigid
R6 animations with hip-led torque, a guarding off-hand, fast extension and
follow-through. The dagger is hidden during unarmed punches.

ICE FISTS AND FULL EXTENSION
Seven faceted ice crystals cap each fist and follow its original arm bone in
all animations. At punch contact the chest turns fully sideways (about 90
degrees), the striking arm extends straight forward, and the off-hand guards
the face. The greater weight transfer and crystal tips increase reach.
