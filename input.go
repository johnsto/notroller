package main

import "io"

type FeatureFlag int

const (
	LeftAnalogStick FeatureFlag = 1 << iota
	RightAnalogStick
	DPad
	StartButton
	SelectButton
	ABButtons
	XYButtons
)

const (
	SimpleDPad   FeatureFlag = DPad | StartButton | SelectButton | ABButtons
	SimpleAnalog FeatureFlag = LeftAnalogStick | StartButton | SelectButton | ABButtons | XYButtons
)

type Button int16
type Abs int64

// Inputer is any type that represents an input device such as a gamepad.
type Inputer interface {
	io.Closer
	// SendAbs sends an absolute axis value, such as an analog stick on a gamepad.
	SendAbs(Abs, int) error
	// SendButton sends a button value, such as a button press on a gamepad.
	SendButton(Button, int) error
}
