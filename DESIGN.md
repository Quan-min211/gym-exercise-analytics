/**
 * FitData Hub — DESIGN.md companion
 * Direction: Iron Plate / Powerlifting Meet
 * Recorded after first build pass (impeccable document)
 */

# Design System — FitData Hub

<!-- impeccable:design-schema 1 -->

## Visual World

Iron Plate / Powerlifting Meet. The interface is built from the vocabulary of heavy competition:
scoreboards, meet programs, iron plate typography, chalk-marked equipment. Every visual decision
asks: "would this belong in a serious powerlifting environment?" Not a lifestyle app — a serious tool
that respects the user's discipline.

## Color

| Role | Value | Usage |
|---|---|---|
| Ground | `#111318` | Page background — iron-black |
| Surface | `#1e2028` | Cards, panels — steel plate |
| Raised | `#252830` | Elevated elements |
| Hover | `#2c3040` | Interactive hover state |
| Border | `#2e3240` | Default separators |
| Accent | `#D32F2F` | Steel red — CTA, active nav, stat borders |
| Accent hover | `#EF5350` | Lifted red |
| Gold | `#FFC107` | Medal/achievement highlights |
| Text Primary | `#F5F5F5` | Headlines |
| Text Secondary | `#B0B8C8` | Body copy |
| Text Muted | `#707888` | Captions, labels |

Color strategy: **Restrained** — iron-black ground + one saturated red. Gold appears only for
achievement/highlight contexts. No gradients on components.

## Typography

| Role | Font | Weight | Transform |
|---|---|---|---|
| Display / Headings | Barlow Condensed | 800–900 | UPPERCASE |
| Navigation | Barlow Condensed | 700 | UPPERCASE |
| Labels / Tags | Barlow Condensed | 700 | UPPERCASE |
| Body copy | Barlow | 400–500 | Normal |
| Mono data | JetBrains Mono | 400 | Normal |

Key rule: all headings are uppercase Barlow Condensed. Body paragraphs use Barlow (not condensed)
for readability. Letter-spacing on headings: 0.01–0.02em; labels: 0.08–0.14em.

## Borders & Radius

Angular over rounded — minimal radii everywhere.
- Components: `--radius-lg` (8px) max
- Buttons: `--radius-sm` (3px)
- Tags: `--radius-sm` (3px)
- No `border-radius: 50%` on step indicators — use square bubbles

## Key Components

**Stat cards:** Red top-border accent (3px) — scoreboard readout. Value font is Barlow Condensed Black at ~60px.

**Page hero:** Full-width iron-black panel with diagonal texture lines (repeating-linear-gradient),
3px red bottom border. Heading at clamp(2.5rem, 6vw, 5rem).

**Header:** 60px height, near-black with blur, 2px solid red bottom border. Logo uppercase condensed.

**Buttons:** Square corners (3px radius), uppercase condensed font, 0.1em letter-spacing.

## Anti-Patterns (banned for this direction)

- No teal, no purple, no generic blue CTA
- No rounded pill buttons (border-radius > 5px on .btn)
- No glassmorphism / frosted panels
- No gradient backgrounds on cards
- No `border-radius: 50%` on step bubbles
- No bounce/elastic easing (cubic-bezier with overshoot)
- No Inter or Outfit as heading fonts
