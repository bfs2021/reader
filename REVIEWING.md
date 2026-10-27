# Reviewing a release

Each milestone ends with an issue titled **Perform Release Review**. It looks back over what the milestone
changed, before it's tagged. This page is how that review is done. It's meant to be argued with: if a step
misses things, or costs more than it finds, open a pull request against this page.

Each review's report is kept in [`reviews/`](reviews/), one file per release, so that the decisions it made can
be checked later against what happened.

## What's reviewed

Everything since the last release's tag, `git log vX.Y.Z..main`, looked at four ways:

- **Technical debt:** duplication, dead code, and things worked around rather than fixed.
- **Quality:** tests missing for what changed, lint, naming, and whether the docs and the README say what the
  code now does.
- **Correctness:** bugs, especially where two changes from the same milestone meet, since each was built and
  tested on its own.
- **Accessibility:** WCAG 2.2 AA for what's new. That means axe in light, dark, more contrast and forced colours;
  the accessibility tree; a keyboard trace through each new flow; and what a screen reader is told along the way.

## How a finding is made

- **Reproduce it,** by running it, by a scratch test, or in a headless browser. Say when a finding is from reading
  only.
- **Name where it is,** as `file:line` at the commit reviewed.
- **Check it isn't already known.** Look at the open issues in every milestone, and at the flags each issue's work
  already raised.
- **Write down what isn't a finding, too.** A candidate looked at and set aside goes in the report with the reason:
  already covered by an issue, deliberate, a browser's limit, checked and fine, or too small to file. The
  set-aside list is how a reader can tell what the review looked at, not only what it found.
- **Keep security findings private.** A security finding is never written in an issue, a pull request or a
  report. See [SECURITY.md](SECURITY.md).

## Where a finding goes

Each finding gets a milestone by three questions, in order:

1. **Is it new in this milestone, and small?** Then fix it before the tag, as a polish of the issue that introduced
   it (its commit ends `Polish gh-N`). A release shouldn't ship a regression of its own making.
2. **Does it matter for what this milestone is for?** Each milestone's description says what that is (a talk, a
   dashboard, a way of sharing). If the finding gets in the way of it, it goes in this milestone.
3. **Otherwise, where does it fit?** The milestone whose theme it belongs to, or an existing issue that already
   covers the same code, as a new bullet there rather than a new issue.

A finding small and self-contained enough for a first contribution is labelled `good first issue`. Its issue says
what to change, why, and how to check it: a test that fails without the fix, and steps to see it by hand.

## The report

`reviews/X.Y.Z.md` holds:

- how the review was done, if it differed from this page;
- what was fixed before the tag, and the issue each one polishes;
- each finding filed for later, with its issue, its milestone and why;
- what was set aside, and why;
- whether the milestones that follow should move: if the work is ahead, what can be pulled forward.

The review issue gets a short comment linking to the report.

## Then

Once the review's fixes are merged and its milestone has no open issues, the release workflow tags it and writes
the release notes (`.github/workflows/release.yml`).
