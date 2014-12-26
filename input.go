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

type Button int16
type Axis int64

const (
	AxisX  Axis = C.ABS_X
	AxisY  Axis = C.ABS_Y
	AxisRX Axis = C.ABS_RX
	AxisRY Axis = C.ABS_RY
)

const (
	BtnA       Button = C.BTN_A
	BtnB       Button = C.BTN_B
	BtnX       Button = C.BTN_X
	BtnY       Button = C.BTN_Y
	BtnStart   Button = C.BTN_START
	BtnSelect  Button = C.BTN_SELECT
	BtnForward Button = C.BTN_FORWARD
	BtnBack    Button = C.BTN_BACK
	BtnLeft    Button = C.BTN_LEFT
	BtnRight   Button = C.BTN_RIGHT
)

type Input struct {
	uidev *C.struct_libevdev_uinput
	f     *os.File
}

func NewInput(name string) (*Input, error) {
	var rc C.int
	var dev *C.struct_libevdev
	var uidev *C.struct_libevdev_uinput

	dev = C.libevdev_new()
	C.libevdev_set_name(dev, C.CString(name))

	var abs C.struct_input_absinfo
	abs.value = 0
	abs.minimum = -32768
	abs.maximum = 32768
	abs.fuzz = 0
	abs.flat = 0
	abs.resolution = 5

	C.libevdev_enable_event_type(dev, C.EV_ABS)
	C.libevdev_enable_event_code(dev, C.EV_ABS, C.ABS_X, unsafe.Pointer(&abs))
	C.libevdev_enable_event_code(dev, C.EV_ABS, C.ABS_Y, unsafe.Pointer(&abs))

	C.libevdev_enable_event_type(dev, C.EV_KEY)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_A, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_B, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_X, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_Y, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_FORWARD, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_BACK, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_LEFT, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_RIGHT, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_START, nil)
	C.libevdev_enable_event_code(dev, C.EV_KEY, C.BTN_SELECT, nil)

	f, err := os.OpenFile("/dev/uinput", os.O_RDWR, 0660)
	if err != nil {
		e := C.strerror(rc)
		return nil, fmt.Errorf("Error %d: %s", rc, C.GoString(e))
	}

	var fd C.int
	fd = C.int(f.Fd())

	rc = C.libevdev_uinput_create_from_device(dev, fd, &uidev)
	if rc < 0 {
		e := C.strerror(rc)
		return nil, fmt.Errorf("Error %d: %s", rc, C.GoString(e))
	}

	return &Input{
		uidev: uidev,
		f:     f,
	}, nil
}

func (i *Input) Close() {
	C.libevdev_uinput_destroy(i.uidev)
	i.f.Close()
}

func (i Input) SendAbs(axis Axis, value int) {
	C.libevdev_uinput_write_event(i.uidev, C.EV_ABS, C.uint(axis), C.int(value))
	C.libevdev_uinput_write_event(i.uidev, C.EV_SYN, C.SYN_REPORT, 0)
}

func (i Input) SendKey(btn Button, value int) {
	C.libevdev_uinput_write_event(i.uidev, C.EV_KEY, C.uint(btn), C.int(value))
	C.libevdev_uinput_write_event(i.uidev, C.EV_SYN, C.SYN_REPORT, 0)
}
