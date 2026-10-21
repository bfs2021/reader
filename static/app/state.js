/**
 * What every part of the app shares: the page's elements, the open file and
 * what's known of it on disk, and the deck being presented.
 */



const $ = (id) => document.getElementById(id);
export const el = {
  rootName: $('rootName'), crumb: $('crumb'), copyPath: $('copyPath'), saveState: $('saveState'),
  sidebarToggle: $('sidebarToggle'), helpToggle: $('helpToggle'), help: $('help'),
  version: $('version'), helpVersion: $('helpVersion'), theme: $('theme'),
  split: $('split'), sidebar: $('sidebar'), filter: $('filter'), files: $('files'),
  newBtn: $('newBtn'), crumbs: $('crumbs'), newForm: $('newForm'), newName: $('newName'),
  preview: $('preview'), pdfView: $('pdfView'), empty: $('empty'),
  writePane: $('writePane'), editor: $('editor'), gutter: $('gutter'), gutterToggle: $('gutterToggle'),
  conflict: $('conflict'), reloadBtn: $('reloadBtn'), overwriteBtn: $('overwriteBtn'),
  dirtyDot: $('dirtyDot'), counts: $('counts'), cursor: $('cursor'), measure: $('measure'), toast: $('toast'),
  workBtn: $('workBtn'), presentBtn: $('presentBtn'), presentWrap: $('presentWrap'), fitPop: $('fitPop'),
  pages: $('pages'), pageBack: $('pageBack'), pageNext: $('pageNext'), pageDots: $('pageDots'), pageCount: $('pageCount'),
  goto: $('goto'), gotoInput: $('gotoInput'), gotoList: $('gotoList'),
  deck: $('deck'), stage: $('stage'), deckNotes: $('deckNotes'), deckBy: $('deckBy'), deckCount: $('deckCount'), deckSays: $('deckSays'), bar: $('bar'),
};

export const RENDER_DELAY = 100;
export const AUTOSAVE_DELAY = 1000;

export const state = {
  rootName: '',
  root: '',
  files: [],
  dir: '',              // the folder the file list shows
  group: null,          // or the versions of this file in it, by name
  outline: false,       // or, below either, the open file's outline
  current: null,        // { path, type }
  saved: '',            // text as last written to / read from disk
  mtime: null,          // disk mtime that `saved` corresponds to
  conflict: false,
  renderSeq: 0,         // drops out-of-order render responses
  openSeq: 0,           // drops superseded file opens
  saving: Promise.resolve(),
  previewReady: null,
  pendingRender: null,
  working: false,       // work mode: rendered full width, filled in but not edited
};

// The slides being presented, if any. See "presenting" below.
export const deck = {
  open: false,
  slides: [],           // [{ body, notes, line }]
  css: '',
  meta: {},
  end: null,            // when the talk should end, by its plan
  index: 0,
  reveal: 0,            // how many of this slide's steps are showing
  notes: false,         // the notes strip under the slide
  stageReady: null,
  channel: null,        // talks to the speaker view
  returnTo: null,       // what had focus before Present
};

export const dirty = () => state.current?.type === 'md' && el.editor.value !== state.saved;
