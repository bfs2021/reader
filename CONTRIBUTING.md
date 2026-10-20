# Contributing

Node 20.19+.

```console
$ git clone https://github.com/jzheaux/reader && cd reader
$ npm install
$ npm test
$ npm run lint
```

The documentation is in [`docs/`](docs/), written in reader-markdown and
published to <https://jzheaux.github.io/reader/> on each push to `main`. To
see a page as it'll be published, open `docs` in reader, or export it:

```console
$ cd docs && node ../bin/reader.js export *.md
```

A change to what reader-markdown does goes in its page there, with a sample
in a `::: tabs` block, its `+++ Source` and `+++ Rendered` tabs.

## Layout of the code

| | |
| --- | --- |
| `bin/reader.js` | CLI |
| `src/export-cli.js`, `src/browser.js` | `reader export`, and the headless browser it draws with |
| `action.yml` | the GitHub Action |
| `src/server.js` | HTTP API and static files |
| `src/content.js` | the content directory: listing, safe paths, saves, backups, the trash, branching, renaming and promoting versions |
| `src/render.js` | markdown → `{css, body}` for the preview: one markdown-it, with every feature, laid out in columns |
| `src/columns.js` | the two-column layout: the speaker's passages beside the asides written against them, under the masthead |
| `features/` | one directory per piece of syntax: its markdown-it plugin, CSS, tests and, if it can be clicked, the `preview.js` that makes it so (so far: `asides`, `fields`, `tasks`, `qa`, `definitions`, `sizes`, `alerts`, `attributions`, `styles`, `columns`, `tabs`, `date`, `scripture`, `scripture-lds`, `search`, `social`, `math`, `arrows`, `emoji`, `highlight`, `mermaid`, `headline`, `number`, `puzzles`, `marks`) |
| `tools/gutenberg/` | brings public-domain books in from Project Gutenberg as reader-markdown (`books.js` lists them, `convert.js` reads one): `node tools/gutenberg/import.js <cache> <library>` |
| `src/slides.js` | a `slides`-format deck → rendered slides and their notes |
| `src/pacing.js` | a deck's pacing plan: checkpoints and budgets from the notes, and when each slide should start |
| `src/fonts.js` | a document's own fonts: `font:` and `title-font:` in the front matter |
| `src/background.js` | what's behind a page or a slide: `background:` in the front matter, or in a slide's notes |
| `src/transition.js` | how one slide gives way to the next: `transition:` in the front matter, or in a slide's notes |
| `static/app/` | the app, a module each: `main.js` (start, events, keys), `files.js` (the file list), `outline.js` and `sections.js` (the open file's outline), `goto.js` (going to a place, `⌃G`), `extracting.js` (taking a part out into a file), `versions.js` (folders, and which files are versions of which), `manage.js` (branching, renaming, the trash), `render.js` (the preview), `saving.js`, `editing.js`, `lines.js` (line numbers, copying where you are), `modes.js` (layout, work mode), `pages.js` (a deck worked through a page at a time), `deck.js` (presenting), `screens.js` (two-screen presenting), `fit.js` (slides that don't fit), `pdf.js`, `status.js`, `api.js`, `state.js` |
| `static/preview.html` | the sandboxed preview frame |
| `static/preview-api.js` | what the frame offers the scripts drawn into it: `Preview.edit`, `Preview.register`, `Preview.wait` |
| `static/preview.js` | the frame itself: rendering, slide steps, fitting a slide, image peeks, shortcuts |
| `static/edits.js` | edits the preview asks for, checked against the lines they were drawn from |
| `static/picks.js` | the versions picked in `tabs` and `compare` blocks, kept for the frames, which have no storage of their own |
| `features/puzzles/` | puzzle fences: found and wrapped (`index.js`), drawn, played and posted back in the preview (`preview.js`) |
| `features/puzzles/kinds/` | one file per kind of puzzle; a file here is a fence name |
| `static/speaker.html` | the speaker view for a deck being presented |

PDF.js is vendored in `static/vendor/`, Mermaid in `features/mermaid/vendor/`, and the sites' marks in `features/social/icons/`; their versions and licenses are noted there.
