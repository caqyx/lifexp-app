# Rush level editor — the level file

Wave Rush, Ship Rush and Flip Rush share one editor (`editor.html` in each game). It exports
one JSON file per level. The owner sends these files to show what to change. Import
checks every field and lists each problem with its path. A path looks like
`sections[2].hazards[5].x`.

The format is version 2. Version 2 adds turned, mirrored and scaled items, free heights,
portal gates and `verified`. Version 1 files still import: they load as version 2, not
verified, and may not use the new fields.

```json
{
  "format": "LifeXP Rush level",
  "version": 2,
  "game": "flip-rush",
  "name": "My level",
  "tier": "hard",
  "verified": false,
  "sections": [
    {
      "length": 30,
      "ceil": "2 r30",
      "floor": "10 r30",
      "mode": "ball",
      "hazards": [
        { "type": "spike", "x": 8, "on": "floor", "count": 3 },
        { "type": "block", "x": 10, "y": 5, "w": 2, "h": 1, "rot": 90, "sx": 1.5 },
        { "type": "spike", "x": 11, "y": 5, "dir": "up", "fy": true },
        { "type": "speed", "x": 12, "k": "fast" },
        { "type": "saw", "x": 18, "y": 6, "r": 0.8, "move": { "dx": 0, "dy": 2, "every": 8 } }
      ]
    }
  ]
}
```

## Top-level fields

- **`game`**: `wave-rush`, `ship-rush` or `flip-rush`. A level only loads in its own game.
- **`tier`**: one of the game's difficulty tiers (`TIERS` in its `config.js`), for example
  `easy`, `hard`, `insane`, `extremeDemon` or `finale`. The tier sets the speed and the
  human limits the validator proves against.
- **`verified`**: `true` when the maker finished the level in the game with
  **Zweryfikuj** (Verify), and has not changed it since. Any change in the editor sets it
  back to `false`; renaming does not. A file may be exported either way.
- **`sections`**: 1–60 sections, played in order. A vehicle portal goes in a joint
  wherever the vehicle changes. A section is the same data as the games' own sections
  (`_engine/geometry.js`, `SectionData`).

## Section fields

- **`length`**: 10–80 cells.
- **`ceil`** and **`floor`**: profiles, for example `"2 r8 +2 r14 -2 r8"`. Each starts
  with a height, then:
  - `rN`: N cells level;
  - `+N` or `−N`: a step down or up (y grows downward);
  - `dN` or `uN`: a 45° slope (Wave Rush only).

  The joints are the ceiling at 2 and the floor at 10, with 2 level cells at each end.
- **`mode`**: the vehicle the section starts in: `wave`, `ship`, `ball` or `spider`, in
  every game. A game flies its own vehicles as it always does: Wave Rush the wave and its
  own ship, Ship Rush the ship and the wave, Flip Rush the ball and the spider. A vehicle
  from another game flies by that game's physics, in the same world. For example, the ship
  in a Wave Rush level that starts as the ball is Ship Rush's ship, which can land on
  blocks. It is drawn by that game's drawing in the player's colours.
  - The level starts in its first section's vehicle.
  - Where a section starts in a vehicle other than the one the section before ends in, a
    vehicle portal stands 1 cell into it.
  - Gravity, size and speed carry on over a joint as they are. Nothing resets between the
    sections of an editor's level.
- **`mini`**: `true` marks the section as a mini stretch. Inside it, use the mini and big
  portals.

## Items in `hazards`

| type | fields | games |
|---|---|---|
| `spike`, `halfSpike` | `x`, `on: floor/ceil` (or `y` + `dir: up/down`), `count`, transform | all (`halfSpike`: Wave and Ship) |
| `block` | `x`, `y`, `w`, `h` (a solid box), transform | all |
| `pillar` | `x`, `on`, `h`, `w?`, `y?` (its top, anywhere), transform | all |
| `saw`, `mine`, `orb` | `x`, `y`, `r`, `move?`, `rot?`, `sx?`, `sy?` (`orb`: Wave and Ship) | all |
| `ring` (orb) | `x`, `y`, `kind: jump/small/gravity/gravityJump/dash`, `sx?`, `sy?` | Flip |
| `pad` | `x`, `on`, `kind: jump/small/gravity`, `y?`, `fy?`, `rot?` | Flip |
| `speed` | `x`, `k: slow/normal/fast/veryFast` (× 0.8 / 1 / 1.25 / 1.5) | all |
| `portal` | `x`, `kind` (below), `y?`, `sy?` (a gate) | all |
| `dark` | `from`, `to` (only the view narrows) | all |
| `invert` | `from`, `to` (hold = sink) | Ship |

- **Portal kinds**:
  - `flip` turns gravity over, whichever way it is (yellow, chevrons both ways).
  - `down` sets gravity to normal (blue, chevrons down).
  - `up` sets it upside down (amber, chevrons up).
  - `mini` makes the vehicle small; `big` makes it full size again (chevrons in or out).
  - `wave`, `ship`, `ball` and `spider` switch the vehicle. The ring shows the vehicle in
    the middle: a zigzag, a hull, a crossed circle or a body with legs.

  Every portal is told apart by its shape and signs, not only its colour. Every kind
  works in every game, anywhere in a section and any number of times. A section may end
  in another state than it began. The game's own sections still use only `flip`, `mini`
  and `big`, flips in pairs and mini back to big, as their validator requires.
- **`move`** is `{ dx, dy, every, phase? }`. The item swings by (dx, dy) along a sine, once
  every `every` cells the vehicle runs. It works in Ship Rush and Flip Rush.
- **`x`** is cells from the section's start.
- **`y`** is cells down from the top (the playfield is 0–12; −1.5 to 13.5 is allowed).
  A spike's `y` is its base and `dir` the way it points. A block's `y` is its top. Any
  item may float: nothing has to stand on the floor or the ceiling.

## Transforms (version 2)

`rot` (degrees clockwise, −360 to 360), `fx` (mirror across), `fy` (mirror up and down),
`sx` and `sy` (scale, 0.25–4). All are optional; a missing field is no change. The game's
own sections have none, so they play exactly as before.

An item is scaled, then mirrored, then turned, about the centre of its box. The hit shape
turns with the drawing in every vehicle (wave, ship, ball, spider):

- **Spikes**: a turned spike is a turned triangle, and its smaller hit triangle turns with
  it. A row (`count`) turns, mirrors and scales as one.
- **Blocks and pillars**: scaled, they are bigger solids to ride on. Turned by a right
  angle (0°, 90°, 180°, 270°), they are still solids. Turned by any other angle, they are
  **tilted**: there is no flat top to ride, so they are deadly, like spikes.
- **Saws, mines and spiked orbs** stay round. The radius is `r` × the larger of `sx` and
  `sy`. `rot` turns only the drawing; mirroring does nothing.
- **Orbs** (`ring`): `sx`/`sy` scale the drawing and the reach (× the larger). They do not
  turn or mirror.
- **Pads**: `fy` (or `rot` between 90° and 270°) turns the pad upside down, so it faces the
  other way. Pads keep their size.
- **Portals** (every kind): a portal spans the corridor where it stands. With
  `y`, it is a gate 3 × `sy` cells high, centred on `y`. Only a vehicle inside the gate
  passes it. A practice respawn after a gate counts it as passed. Portals stay upright.
- **Speed portals**, **`dark`** and **`invert`** always span the corridor. They have no
  transform.

## In the editor

- The board shows the whole level as one strip. The section borders are marked, and the
  section bar edits the section in the middle of the view.
- Any tool places its item where you tap, snapped to the grid (1, ½ or ¼ cell, or free).
  The new item is selected.
- **Zaznacz** (Select): tap an item to select it, Shift-tap to add one, and drag to move
  the selection. Shift-drag, or the **Obszar** (Box select) tool, selects a box. Dragging
  empty board moves the view. Two fingers or the mouse wheel zoom.
- The selection bar shows x and y, nudge buttons, the turn (snapped to 15°, 90° or free)
  with −90°/+90°, the mirrors, the scale (uniform or X and Y apart), a portal's gate, and
  copy, paste, duplicate and delete. The keyboard does the same: arrows, Delete,
  Ctrl+C, Ctrl+V and Ctrl+D. On a phone, the round handle under the selection moves it.
- An item moved past a section border goes into that section.
- Every game has every portal tool:
  - **Portal prędkości** (speed);
  - **Portal grawitacji** (gravity: turn over, down or up);
  - **Portal mini** and **Portal duży** (mini and big);
  - **Portal pojazdu** (vehicle: ship, wave, ball or spider).
- The section's vehicle (Pojazd) offers all four vehicles.
- **Testuj** (Test) plays the level in the game, from the start or from the current
  section. It plays in practice mode, with a checkpoint every section.
- **Zweryfikuj** (Verify) plays the level from the start in normal mode, with no
  checkpoints: a crash starts it again. Finishing it marks the level verified. Any later
  change takes the mark away.
- Neither a test nor a verification counts attempts, keeps records or gives achievements.
- Up to five saves are kept in this browser (`<game prefix>editor-slots`).
