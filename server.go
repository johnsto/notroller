package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/codegangsta/cli"
	"github.com/codegangsta/negroni"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/unrolled/render"
)

var upgrader websocket.Upgrader

func init() {
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
}

func main() {
	app := cli.NewApp()
	app.Name = "gostick"
	app.Usage = "Gamepads-over-WiFi"

	app.Flags = []cli.Flag{
		cli.IntFlag{
			Name:  "num",
			Value: 2,
		},
		cli.StringFlag{
			Name:  "name",
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

	app.Action = func(c *cli.Context) {
		rend := render.New(render.Options{
			Directory:     "templates",
			Extensions:    []string{".html"},
			IndentJSON:    true,
			IsDevelopment: true,
		})

		router := mux.NewRouter()

		num := c.Int("num")

		// Create inputs
		inputs := make([]*Input, num)
		for i := 0; i < num; i++ {
			input, err := NewInput(fmt.Sprintf("GoStick #%d", i))
			if err != nil {
				log.Fatalln(err)
			}
			defer input.Close()
			inputs[i] = input
		}

		router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			ports := make([]int, num)
			for i := 0; i < num; i++ {
				ports[i] = i
			}
			rend.HTML(w, http.StatusOK, "index", struct {
				Host  string
				Num   int
				Ports []int
			}{r.Host, num, ports})
		})

		router.HandleFunc("/{port:[0-9]+}", func(w http.ResponseWriter, r *http.Request) {
			rend.HTML(w, http.StatusOK, "gamepad", struct {
				aHost string
				Num   int
				Ports []int
			}{r.Host, num, make([]int, num)})
		})

		router.HandleFunc("/{port:[0-9]+}/ws", func(w http.ResponseWriter, r *http.Request) {
			vars := mux.Vars(r)
			port, _ := strconv.Atoi(vars["port"])
			input := inputs[port]

			log.Printf("Connecting %s to port #%d\n", r.Host, port)

			conn, err := upgrader.Upgrade(w, r, nil)
			defer conn.Close()
			if err != nil {
				log.Println(err)
				return
			}

			HandleConn(input, conn)
		})

		n := negroni.Classic()
		n.UseHandler(router)

		port := c.Int("port")
		n.Run(fmt.Sprintf(":%d", port))
	}

	app.Run(os.Args)
}

type InputEvent struct {
	Axis   string      `json:"a"`
	Button string      `json:"b"`
	Value  json.Number `json:"v"`
	Time   json.Number `json:"t"`
}

func HandleConn(input *Input, conn *websocket.Conn) {
	var ev InputEvent
	for {
		err := conn.ReadJSON(&ev)
		log.Printf("%#v", ev)

		if err != nil {
			log.Println("couldn't read: ", err)
			break
		}

		v64, err := ev.Value.Int64()
		if err != nil {
			log.Println("couldn't get value: ", err)
			continue
		}
		var v = int(v64)

		switch ev.Axis {
		case "x":
			input.SendAbs(AxisX, v)
		case "y":
			input.SendAbs(AxisY, v)
		}

		buttons := strings.Split(ev.Button, " ")
		for _, button := range buttons {
			switch button {
			case "start":
				input.SendKey(BtnStart, v)
			case "select":
				input.SendKey(BtnSelect, v)
			case "a":
				input.SendKey(BtnA, v)
			case "b":
				input.SendKey(BtnB, v)
			case "x":
				input.SendKey(BtnX, v)
			case "y":
				input.SendKey(BtnY, v)
			case "forward":
				input.SendKey(BtnForward, v)
			case "back":
				input.SendKey(BtnBack, v)
			case "left":
				input.SendKey(BtnLeft, v)
			case "right":
				input.SendKey(BtnRight, v)
			}
		}

		conn.WriteJSON(struct {
			Time json.Number `json:"t"`
		}{ev.Time})
	}

	log.Println("Stopped listening")
}
