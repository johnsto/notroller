package main

// #cgo pkg-config: libevdev
// #include <libevdev/libevdev.h>
// #include <libevdev/libevdev-uinput.h>
// #include <string.h>
import "C"

import (
	"fmt"
	"os"
	"unsafe"
)

// Absolute axis constants
const (
	AbsX  Abs = C.ABS_X
	AbsY  Abs = C.ABS_Y
	AbsRX Abs = C.ABS_RX
	AbsRY Abs = C.ABS_RY
)

// Button constants
const (
	BtnA         Button = C.BTN_A
	BtnB         Button = C.BTN_B
	BtnX         Button = C.BTN_X
	BtnY         Button = C.BTN_Y
	BtnStart     Button = C.BTN_START
	BtnSelect    Button = C.BTN_SELECT
	BtnForward   Button = C.BTN_FORWARD
	BtnBack      Button = C.BTN_BACK
	BtnLeft      Button = C.BTN_LEFT
	BtnRight     Button = C.BTN_RIGHT
	BtnDpadUp    Button = C.BTN_DPAD_UP
	BtnDpadDown  Button = C.BTN_DPAD_DOWN
	BtnDpadLeft  Button = C.BTN_DPAD_LEFT
	BtnDpadRight Button = C.BTN_DPAD_RIGHT
)

type linuxInputer struct {
	uidev *C.struct_libevdev_uinput
	f     *os.File
}

func NewInput(name string, flags FeatureFlag) (*linuxInputer, error) {
	var rc C.int
	var dev *C.struct_libevdev
	var uidev *C.struct_libevdev_uinput

	dev = C.libevdev_new()
	C.libevdev_set_name(dev, C.CString(name))

	// Build up some basic absolute axis defaults
	var abs C.struct_input_absinfo
	abs.value = 0
	abs.minimum = -100
	abs.maximum = 100
	abs.fuzz = 5
	abs.flat = 0
	abs.resolution = 1

	// Absolute axis (sticks)
	C.libevdev_enable_event_type(dev, C.EV_ABS)
	if flags&LeftAnalogStick == LeftAnalogStick {
		C.libevdev_enable_event_code(dev, C.EV_ABS, C.ABS_X, unsafe.Pointer(&abs))
		C.libevdev_enable_event_code(dev, C.EV_ABS, C.ABS_Y, unsafe.Pointer(&abs))
	}
	if flags&RightAnalogStick == RightAnalogStick {
		C.libevdev_enable_event_code(dev, C.EV_ABS, C.ABS_RX, unsafe.Pointer(&abs))
		C.libevdev_enable_event_code(dev, C.EV_ABS, C.ABS_RY, unsafe.Pointer(&abs))
	}

	// Face buttons
	C.libevdev_enable_event_type(dev, C.EV_KEY)
	if flags&StartButton == StartButton {
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_START, nil)
	}
	if flags&SelectButton == SelectButton {
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_SELECT, nil)
	}
	if flags&ABButtons == ABButtons {
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_A, nil)
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_B, nil)
	}
	if flags&XYButtons == XYButtons {
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_X, nil)
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_Y, nil)
	}
	if flags&DPad == DPad {
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_DPAD_UP, nil)
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_DPAD_DOWN, nil)
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_DPAD_LEFT, nil)
		C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_DPAD_RIGHT, nil)
	}

	// Open uinput
	f, err := os.OpenFile("/dev/uinput", os.O_RDWR, 0660)
	if err != nil {
		e := C.strerror(rc)
		return nil, fmt.Errorf("Error %d (%s) opening /dev/uinput : %s", rc, C.GoString(e), err)
	}

	// Get file hanadle
	var fd C.int
	fd = C.int(f.Fd())

	// Create new uinput device
	rc = C.libevdev_uinput_create_from_device(dev, fd, &uidev)
	if rc < 0 {
		f.Close()
		e := C.strerror(rc)
		return nil, fmt.Errorf("Error %d creating uinput device: %s", rc, C.GoString(e))
	}

	return &linuxInputer{
		uidev: uidev,
		f:     f,
	}, nil
}

func (i *linuxInputer) Close() error {
	C.libevdev_uinput_destroy(i.uidev)
	return i.f.Close()
}

// SendAbs sends an absolute axis value, such as an analog stick on a gamepad.
func (i linuxInputer) SendAbs(abs Abs, value int) error {
	if err := i.send(C.EV_ABS, C.uint(abs), C.int(value)); err != nil {
		return err
	}
	return i.send(C.EV_SYN, C.SYN_REPORT, 0)
}

// SendButton sends a button value, such as a button press on a gamepad.
func (i linuxInputer) SendButton(btn Button, state int) error {
	if err := i.send(C.EV_KEY, C.uint(btn), C.int(state)); err != nil {
		return err
	}
	return i.send(C.EV_SYN, C.SYN_REPORT, 0)
}

// send writes an arbitrary event and sync through uinput, converting the
// return code into an appropriate error.
func (i linuxInputer) send(t C.uint, c C.uint, v C.int) error {
	var rc C.int
	if rc = C.libevdev_uinput_write_event(i.uidev, t, c, v); rc < 0 {
		e := C.strerror(rc)
		return fmt.Errorf("Error %d sending event: %s", rc, C.GoString(e))
	}
	return nil
}
