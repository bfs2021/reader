---
title: Riverbend Dev Days, day 1
date: October 2026
---

← [How to Take Notes Like a Boss](../tutorial.md)

Your ten minutes:

- [ ] Add an aside to the keynote
- [ ] Turn the retries question into `Q:` and `A:`
- [ ] Define `!SLO`
- [ ] Quote one line
- [ ] Write one task per talk
- [ ] Take *The Docs Nobody Reads* out into a file of its own

reset:[Start over]

# Boring Software

Priya Raman, keynote

- most outages come from the new thing, not the old thing
- innovation tokens, each team gets about three
- choose boring tech for everything that isn't your product
- credited Dan McKinley, Choose Boring Technology
- graph of incidents by age of dependency, drops off after year 2
- SLO?
- audience asked when to spend a token, she said when it's the thing customers pay for
- "Boring is a feature you only notice when it's gone."

---

# Backpressure for the Rest of Us

Tomás Ortega

- producer faster than consumer, something has to give
- three choices: buffer, drop, or slow the producer down
- pick one on purpose
- an unbounded queue is choosing to crash later
- our importer does exactly this
- he asked who has a queue with no max, half the room
- someone asked if retries count, he said retries are just a producer you forgot about

---

# The Docs Nobody Reads

Dana Whitfield

- write for the person reading at 2am
- one task per page
- examples first, explanation after
- "If the example is wrong, the docs are wrong."
- test the examples in CI
- she reads the support tickets every Friday to find what to write next
- our README starts with history
