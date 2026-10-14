## Handling Tasks

1. Please mark a task as done by adding an x
2. Please use "-s" when committing to that my signoff appears
3. Please add 'Closes gh-xxx' to the end of the commit message where xxx is the ticket number

## P1

- [x] github:jzheaux/reader#5[] N/P advancement. A small bug fix, and you need to be able to trust the keys on stage.
- [x] #10 Code highlighting in the rendered view. Fairly self-contained, and your slides need it.
- [x] #4 Slides that don't fit. This is probably also why N sometimes seems not to show the whole slide.
- [x] When slides advance with n and when the slides start, the remaining parts briefly flash on-screen before disappearing
- [x] #12 Two-screen presenting, pacing, and notes shown as markdown. The notes part is quick. Two screens and pacing are the larger part.
- [x] #2 Attributed asides. Ready to start: it needs front-matter parsing and its own design work, but nothing from another issue.
- [ ] #15 Choose the editor. Not one you named, but I included it because #11 depends on it: a plain textarea can't colour text. Deciding it early also settles how #1 and #9 get built.
- [ ] #11 Editor highlighting.
- [ ] #8 Slide overview grid.
- [ ] #14 Quote and statement layouts. For consideration, decided together with #4.
- [x] #51 Slide transitions: `transition:` in the front matter, or in a slide's notes just above its `---`.

## P2
- [x] #1 scroll sync. Built on the textarea; it didn't need #15.
- [ ] #9 folding: comes after #15.
- [x] #3 directories: a folder at a time, with a file's versions (`slides.arc1.md`) as one row.
- [ ] #7 navigation: a file's outline can be the level after a file in #3's folder view.
- [ ] #17 search.
- [ ] #6 page numbering.
- [ ] #16 problems panel: this would also be the natural home for #4's overflow warnings.
- [ ] #19 export: a handout or PDF of the deck could matter after the talk.
- [ ] #18 templates.
- [ ] #25 `github:` links titled with the issue. Small, and this file could then use it.
- [ ] #26 tabs for more than one version of a passage (Java/Kotlin, NIV/KJV), then inlining text from a reference. For discussion; tabs first.

## P3
- [ ] #13 answer keys.
- [ ] #20 using documents without installing reader.
- [ ] #27 bringing a review back into a changed document, or sharing it live instead. For discussion; overlaps #20.


## Daily dashboard

What the daily self-care dashboard (`daily-self-care`, branch `using-reader`) needs. Not yet placed among P1-P3. Behavior first, then layout, then styling.

### Behavior
- [x] #50 Work, in place of Read: a deck worked through a page at a time. Takes the place of #32, #33 and #46, and is where #34 and #36 land.
- [ ] #29 `pitch:`, a note that plays.
- [ ] #30 a slide's `time:` as a countdown on the slide.
- [ ] #31 `youtube:`, a video that plays in place.
- #32 `steps: off`: not needed. Work (#50) has no steps.
- #33 tasks, radios and fields while presenting: not needed. They're filled in in Work (#50), and Present stays a stage.
- [x] #35 a checkbox on a heading. It marks a page done in Work (#50).
- [ ] #36 `progress: slides`: the dots are Work's (#50). What's left is the bar and the count along the top.
- [ ] #37 `progress:`, a bar for pages read or tasks reviewed.
- [ ] #38 hint text in an empty field.
- [ ] #43 bold lost at the start of a line inside `:::`. A bug; it shows on every book card.
- [ ] #39 `open-until:`, past days as read-only records.
- [x] #40 `--host` and `--allow-host`, to serve from the NAS. The first case of #20.
- #34 Back, Next and swipe: part of Work (#50).
- [ ] #41 `/today`.
- [ ] #42 every day's answers as one CSV. Split out of #19.

### Layout
- [ ] #44 `::: grid N`.
- [ ] #45 `::: row`.
- #46 a deck as a page of cards, not a stage: decided. It's what a deck is in Work (#50).

### Styling
- [ ] #47 a whole list item styled, and `bg-<color>`.
- [ ] #49 choices drawn as cards. May fall out of #48.
- [ ] #48 a deck's own palette, typeface and stylesheet: what keeps the original look.
