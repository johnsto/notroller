notroller
=========

**`notroller` registers itself as a uinput gamepad that can be controlled via
an unsecured webpage. For demo/proof-of-concept purposes only.**

This code used to work well, but it appears inputs are being interpreted
incorrectly in this version.

## Requirements
Linux and Go 1.1 or later, as well as `uinput-devel` (or your distribution's
equivalent) for the C bindings. Run `go get -a` to fetch all other module
dependencies.

Ensure your user has permissions to read `/dev/uinput` - on most Linux systems
this is a simple matter of adding your user to the `input` group (or whatever
group `/dev/uinput` belongs to on your system.)

## Usage
Running this code exposes an HTTP (port 5764 by default) that allows remote
clients to pass input to your machine. Clients can put `http://<host>:5764`
into their web browser to select a gamepad port and a gamepad interface to use.

`notroller` hosts an HTTP server on port 5764 on all network interfaces.

`notroller --help` lists all options. 

## Notes
There are three types of controller: "Retro", "Retro (analog)" and "Wheel"

The Retro controller looks a bit like an 8-bit controller from the 80s. The
"analog" variant interprets positions on the DPad as continuous values
(like an analog stick) as opposed to the non-analog variant that only supports
Up/Down/Left/Right.

The Wheel controller looks like a steering wheel and uses the orientation
sensors of your device.

## Disclaimer
This is a toy project I put together as proof-of-concept. Apologies for the
mess, and use at your own risk.

*Do not use this on an untrusted network, as it allows remote clients to 
send inputs to the host.*
