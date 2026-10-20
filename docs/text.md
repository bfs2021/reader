---
title: Styling text
---

← [Contents](index.md)

## Colors and fonts

Text can be colored and set in another font by naming the styles in braces
after it. A CSS color name (`red`, `slategray`, `rebeccapurple`, ...) sets
the color; any other name is a font, with hyphens for spaces. A font you
don't have falls back to the page's own.

::: tabs
+++ Source
```markdown
[this is red]{red}, and [this is both]{darkgreen times-new-roman}.
```
+++ Rendered
[this is red]{red}, and [this is both]{darkgreen times-new-roman}.
:::

A topic's alias, or `circle`, `underline`, `dotted`, `wavy` or `highlight`,
marks the text instead (see [Asides](asides.md)).

::: tabs
+++ Source
```markdown
[circled]{circle}, [underlined]{underline}, [dotted]{dotted},
[wavy]{wavy} and [highlighted]{highlight goldenrod}.
```
+++ Rendered
[circled]{circle}, [underlined]{underline}, [dotted]{dotted},
[wavy]{wavy} and [highlighted]{highlight goldenrod}.
:::

For whole paragraphs, lists or tables, fence them with `:::`:

::: tabs
+++ Source
```markdown
::: slategray georgia
Everything here is gray and in Georgia,

- lists and tables included,

until the closing line.
:::
```
+++ Rendered
::: slategray georgia
Everything here is gray and in Georgia,

- lists and tables included,

until the closing line.
:::
:::

A `:::` block can also lay out what's in it; see [Layout](layout.md).

## Arrows

`->`, `<-` and `<->` show as →, ← and ↔. A backslash (`\->`) keeps them as
typed.

::: tabs
+++ Source
```markdown
draft -> review -> publish, and \-> as typed
```
+++ Rendered
draft -> review -> publish, and \-> as typed
:::

## Math

`math:[…]` sets relations between ideas as symbols, keeping the words
upright. Alone on its line it is centered like an equation; within a sentence
it stays inline:

| You write | Shows |
| --- | --- |
| `>=` `<=` `!=` `~=` | ≥ ≤ ≠ ≈ |
| `>>` `<<` | ≫ ≪ |
| `->` `<-` `<->` | → ← ↔ |
| `*` `+-` `-` | × ± − |
| `.:` `inf` | ∴ ∞ |

::: tabs
+++ Source
```markdown
math:[readability >> cleverness]

In short, math:[well-known code ~= fast code].
```
+++ Rendered
math:[readability >> cleverness]

In short, math:[well-known code ~= fast code].
:::

A `-` joining two words (`well-known`) stays a hyphen.

## Emoji

Emoji shortcodes like `:tada:` show as 🎉 in the rendered pane but stay as
`:tada:` in the file. Code spans and unknown names are left as written.

::: tabs
+++ Source
```markdown
Shipped :tada: but `:tada:` in code stays.
```
+++ Rendered
Shipped :tada: but `:tada:` in code stays.
:::
