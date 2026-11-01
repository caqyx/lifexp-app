# Rush level editor — the level file

Wave Rush, Ship Rush and Flip Rush share one editor (`editor.html` in each game). It exports
one JSON file per level. The owner sends these files to show what to change. Import
checks every field and lists each problem with its path. A path looks like
`sections[2].hazards[5].x`.

```json
{
  "format": "LifeXP Rush level",
  "version": 1,
  "game": "flip-rush",
  "name": "My level",
  "tier": "hard",
  "sections": [
    {
      "length": 30,
      "ceil": "2 r30",
      "floor": "10 r30",
      "mode": "ball",
      "hazards": [
        { "type": "spike", "x": 8, "on": "floor", "count": 3 },
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
- **`mode`**: the vehicle.
  - Wave Rush: `wave` or `ship`.
  - Ship Rush: `ship` or `wave`.
  - Flip Rush: `ball` or `spider`.
- **`mini`**: `true` makes the section a mini stretch, proven as mini.

## Items in `hazards`

| type | fields | games |
|---|---|---|
| `spike`, `halfSpike` | `x`, `on: floor/ceil` (or `y` + `dir: up/down`), `count` | all (`halfSpike`: Wave and Ship) |
| `block` | `x`, `y`, `w`, `h` (a solid box) | all |
| `pillar` | `x`, `on`, `h`, `w?` | all |
| `saw`, `mine`, `orb` | `x`, `y`, `r`, `move?` (`orb`: Wave and Ship) | all |
| `ring` (orb) | `x`, `y`, `kind: jump/small/gravity/gravityJump/dash` | Flip |
| `pad` | `x`, `on`, `kind: jump/small/gravity` | Flip |
| `speed` | `x`, `k: slow/normal/fast/veryFast` (× 0.8 / 1 / 1.25 / 1.5) | Ship, Flip |
| `portal` | `x`, `kind: flip/mini/big` (flips in pairs; mini ends in big) | Ship, Flip |
| `dark` | `from`, `to` (only the view narrows) | all |
| `invert` | `from`, `to` (hold = sink) | Ship |

- **`move`** is `{ dx, dy, every, phase? }`. The item swings by (dx, dy) along a sine, once
  every `every` cells the vehicle runs. It works in Ship Rush and Flip Rush.
- **`x`** is cells from the section's start.
- **`y`** is cells down from the top (the playfield is 0–12).

## In the editor

- **Sprawdź** (Check) runs the game's own validator on each section at the level's tier.
  It marks where a section fails.
- **Testuj** (Test) plays the level in the game, from the start or from the chosen
  section. It plays in practice mode, with a checkpoint every section.
- Up to five saves are kept in this browser (`<game prefix>editor-slots`).
