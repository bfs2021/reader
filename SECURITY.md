# Security

## Reporting a vulnerability

Please report it privately, through
[Report a vulnerability](https://github.com/jzheaux/reader/security/advisories/new)
on the repository's Security tab, and not in an issue, a pull request or a
discussion. Say what an attacker can do, and how, with the steps or a file
that shows it.

You'll hear back within a week. Once a fix is out, the advisory is
published, crediting you unless you'd rather it didn't.

## Supported versions

Fixes go to `main` and the latest release.

## Scope

reader has no sign-in: whoever can reach the server can read and write the
directory it serves, so the network it listens on is the boundary (see
[Options](README.md#options)). That alone isn't a vulnerability. Reaching
files outside that directory, running script from a document someone else
wrote, or a page on another site reading or changing your files are.
