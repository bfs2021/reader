---
title: Install and run
---

← [Contents](index.md)

## Install

Node 22.13+.

```console
$ git clone https://github.com/jzheaux/reader && cd reader
$ npm install
$ npm link          # puts `reader` on your PATH
```

## Run

```console
$ reader ~/Documents/notes
```

Opens <http://127.0.0.1:8734/>. `Ctrl-C` stops it. Nothing leaves your machine.

Run it again on another directory and that one gets the next free port
(8735, 8736, …), so each directory has its own tab. `--port` asks for one port
exactly.

## Options

```console
$ reader [dir] [--port 8734] [--no-browser] [--open <file>]
         [--host <address>] [--allow-host <name>]...
$ reader export <file>... [--out <file>] [--no-draw]
$ reader --version
```

`dir` defaults to the current directory. By default the server listens
only on `127.0.0.1` and rejects requests addressed to any other host name;
`--host` and `--allow-host` open it to other devices (below). It rejects
any path that would leave `dir`, including through symlinks.

`reader export` saves documents as HTML; see [Export and print](exporting.md).

`reader --version` prints which reader this is, as the foot of the file list
shows it, linked to its release notes: `v0.0.2`, or, run from a checkout
that has moved past that release, `v0.0.2+abc1234`, linked to that commit.

## From another device

To use a directory from another device, say from a home server on a tailnet,
listen elsewhere and name what that machine is reached by:

```console
$ reader /data --no-browser --host 0.0.0.0 --allow-host my-nas
```

`--host` is the address to listen on. `--allow-host` is a name or address a
browser may ask for it by, and can be repeated; loopback names always work,
as does a `--host` address other than `0.0.0.0` or `::`, and nothing else
does unless named. There is no sign-in: whoever can reach
the machine can read and write `dir`, so the network is the boundary. Keep
it to one you trust, such as a tailnet, or put a proxy that signs people in
in front of it.
