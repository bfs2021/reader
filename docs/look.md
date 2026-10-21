---
title: Light and dark
---

← [Contents](index.md)

## Light, Dark or System

**Formatting** opens the help over the editor, and its last row is the
**Theme**: Light, Dark or System. System, the default, follows your
computer's own light or dark mode, and changes when it does. What you pick
is remembered in this browser, and a window already open takes it up too.

The page in the preview follows: in Dark it's drawn on dark paper, light
ink, with its code, tables, alerts, cards and puzzles in their dark colours,
and a Mermaid diagram in Mermaid's dark theme.

- A page's own `background:` ([The page](page.md)) wins over the theme. A
  light one stays light paper with dark ink in Dark, and a dark one stays
  dark in Light.
- Slides follow too, on the stage and in the speaker view. The speaker view
  itself is dark, for a darkened room, unless you pick Light.
- What's saved or printed ([Export and print](exporting.md)) is light,
  whatever the theme, unless its own background is dark; on paper it's
  always light.

## More contrast

When your computer asks for more contrast (macOS: **Increase contrast**;
Windows and others: `prefers-contrast: more`), reader and the page both
take it up, in Light and in Dark:

- Text is 7:1 or better against what it sits on, the softer greys and the
  colours of code, cards, alerts and badges too.
- Rules and borders are darker, 3:1 or better.
- What a faint tint showed is shown another way too: the open file and the
  place picked in **Go to** are outlined, a done task isn't faded, and a
  compare's words are underlined where they're added and struck through
  where they're gone.

## The system's own colours

With Windows' contrast themes, or anything else that sets
`forced-colors: active`, your system's colours replace reader's, and the
tints and shadows go. What they said is kept:

- The open file, the outline entry you're at, a picked row, the page
  showing, the step being worked on, a lit line of code and a puzzle's
  cursor are outlined in the system's highlight colour.
- A highlighter's wash is the system's own mark colour.
- Chips and badges (a reviewer, a numbered step, a done card, an answer)
  stay filled, in the system's colours.
- Puzzles and the lines from a mark to its asides are drawn in the system's
  colours too.
