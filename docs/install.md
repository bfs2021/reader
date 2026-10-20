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
```

`dir` defaults to the current directory. The server only listens on
`127.0.0.1`. It rejects requests addressed to any other host name, and any
path that would leave `dir`, including through symlinks.

`reader export` saves documents as HTML; see [Export and print](exporting.md).

## From another device

To use a directory from another device, say from a home server on a tailnet,
listen elsewhere and name what that machine is reached by:

```console
$ reader /data --no-browser --host 0.0.0.0 --allow-host my-nas
```

`--host` is the address to listen on. `--allow-host` is a name or address a
browser may ask for it by, and can be repeated; loopback names always work,
and nothing else does unless named. There is no sign-in: whoever can reach
the machine can read and write `dir`, so the network is the boundary. Keep
it to one you trust, such as a tailnet, or put a proxy that signs people in
in front of it.
