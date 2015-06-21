package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path"
	"strconv"

	"github.com/codegangsta/cli"
	"github.com/codegangsta/negroni"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/unrolled/render"
)

var upgrader websocket.Upgrader

// Maps of key strings to key values
var absMap map[string]Abs    // "abs:xxx" -> AbsXXX
var btnMap map[string]Button // "btn:xxx" -> BtnXXX

// InputEvent represents an input event from a remote client
type InputEvent struct {
	Key   string      `json:"k"` // Key/button/axis input name
	Value json.Number `json:"v"` // Input value
	Time  json.Number `json:"t"` // Client timestamp
}

func init() {
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	absMap = map[string]Abs{
		"abs:x":  AbsX,
		"abs:y":  AbsY,
		"abs:rx": AbsRX,
		"abs:ry": AbsRY,
	}

	btnMap = map[string]Button{
		"btn:start":      BtnStart,
		"btn:select":     BtnSelect,
		"btn:a":          BtnA,
		"btn:b":          BtnB,
		"btn:x":          BtnX,
		"btn:y":          BtnY,
		"btn:forward":    BtnForward,
		"btn:back":       BtnBack,
		"btn:left":       BtnLeft,
		"btn:right":      BtnRight,
		"btn:dpad-up":    BtnDpadUp,
		"btn:dpad-down":  BtnDpadDown,
		"btn:dpad-left":  BtnDpadLeft,
		"btn:dpad-right": BtnDpadRight,
	}
}

func main() {
	app := cli.NewApp()
	app.Name = "gostick"
	app.Usage = "Gamepads-over-WiFi"

	app.Flags = []cli.Flag{
		cli.IntFlag{
			Name:  "num",
			Value: 4,
		},
		cli.StringFlag{
			Name:  "name",
			Usage: "Name to use for devices",
			Value: "GoStick",
		},
		cli.StringFlag{
			Name:   "addr",
			EnvVar: "HOST",
			Value:  "0.0.0.0",
		},
		cli.IntFlag{
			Name:   "port",
			EnvVar: "PORT",
			Value:  5764,
		},
	}

	app.Action = RunAction
	app.Run(os.Args)
}

func RunAction(c *cli.Context) {
	rend := render.New(render.Options{
		Directory:     "templates",
		Extensions:    []string{".html"},
		IndentJSON:    true,
		IsDevelopment: true,
		Funcs: []template.FuncMap{{
			"json": func(v interface{}) (string, error) {
				b, err := json.Marshal(v)
				return string(b), err
			},
		}},
	})

	router := mux.NewRouter()

	num := c.Int("num")

	// Create inputs
	inputs := make([]Inputer, num)
	for i := 0; i < num; i++ {
		input, err := NewInput(fmt.Sprintf("GoStick #%d", i), SimpleAnalog)
		if err != nil {
			log.Fatalln("Couldn't create input", i, err)
		}
		defer input.Close()
		inputs[i] = input
	}

	handlers := Handlers{
		NumPorts: num,
		Render:   rend,
		Inputs:   inputs,
	}

	if err := handlers.LoadGamepadSpecs(); err != nil {
		log.Fatalln("Couldn't load gamepads:", err)
	}

	router.HandleFunc("/", handlers.HandleIndex)
	router.HandleFunc("/{port:[0-9]+}", handlers.HandleSelect)
	router.HandleFunc("/{port:[0-9]+}/ws", handlers.HandleWS)

	n := negroni.New(
		negroni.NewRecovery(),
		negroni.NewLogger(),
		negroni.NewStatic(http.Dir("public")),
		negroni.NewStatic(http.Dir("gamepads")))
	n.UseHandler(router)

	port := c.Int("port")
	n.Run(fmt.Sprintf(":%d", port))
}

type IndexHandlers struct {
}

type GamepadSpec struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type Handlers struct {
	NumPorts int
	Gamepads []GamepadSpec
	Render   *render.Render
	Inputs   []Inputer
}

func (h Handlers) HandleIndex(w http.ResponseWriter, r *http.Request) {
	ports := make([]int, h.NumPorts)
	for i := range ports {
		ports[i] = i
	}
	h.Render.HTML(w, http.StatusOK, "index", struct {
		Host  string
		Num   int
		Ports []int
	}{r.Host, h.NumPorts, ports})
}

// HandleSelect allows the user to select a gamepad for the chosen port
func (h Handlers) HandleSelect(w http.ResponseWriter, r *http.Request) {
	h.Render.HTML(w, http.StatusOK, "gamepad", struct {
		Host     string
		Gamepads []GamepadSpec
	}{r.Host, h.Gamepads})
}

// HandleWS establishes a websocket connection for the chosen port
func (h Handlers) HandleWS(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	port, _ := strconv.Atoi(vars["port"])
	input := h.Inputs[port]

	log.Printf("Connecting %s to port #%d\n", r.Host, port)

	conn, err := upgrader.Upgrade(w, r, nil)
	defer conn.Close()
	if err != nil {
		log.Println(err)
		return
	}

	c := make(chan InputEvent, 100)
	go func(c chan InputEvent) {
		for ev := range c {
			v64, err := ev.Value.Int64()
			if err != nil {
				log.Println("couldn't get value: ", err)
				continue
			}

			// Send input event
			var v = int(v64)
			if abs, ok := absMap[ev.Key]; ok {
				input.SendAbs(abs, v)
			} else if btn, ok := btnMap[ev.Key]; ok {
				input.SendButton(btn, v)
			}
		}
	}(c)

	for {
		var ev InputEvent
		err := conn.ReadJSON(&ev)

		if err != nil {
			log.Println("couldn't read: ", err)
			break
		}

		log.Printf("%#v", ev)
		c <- ev

		conn.WriteJSON(struct {
			Time json.Number `json:"t"`
		}{ev.Time})
	}

	log.Printf("Disconnected %s from port #%d\n", r.Host, port)
}

func (h *Handlers) LoadGamepadSpecs() error {
	basePath := "gamepads"

	log.Printf("Loading gamepads from `%s`...", basePath)
	dir, err := os.Open(basePath)
	if err != nil {
		return err
	}

	files, err := dir.Readdir(0)
	if err != nil {
		return err
	}

	gamepads := []GamepadSpec{}
	for _, file := range files {
		if path.Ext(file.Name()) != ".json" {
			// skip non-JSON file
			continue
		}

		f, err := os.Open(path.Join(basePath, file.Name()))
		var spec GamepadSpec
		dec := json.NewDecoder(f)
		if err = dec.Decode(&spec); err != nil {
			log.Printf("Couldn't read %s: %s", file.Name(), err)
		} else {
			log.Printf("Found gamepad %s ('%s')", spec.Name, spec.Title)
			gamepads = append(gamepads, spec)
		}
	}

	log.Printf("%d gamepad(s) loaded.", len(gamepads))
	h.Gamepads = gamepads
	return nil
}
