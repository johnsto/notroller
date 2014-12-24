package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/codegangsta/negroni"
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
	rend := render.New(render.Options{
		Directory:     "templates",
		Extensions:    []string{".html"},
		IndentJSON:    true,
		IsDevelopment: true,
	})

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		rend.HTML(w, http.StatusOK, "index", r.Host)
	})

	mux.HandleFunc("/ws", HandleConn)

	n := negroni.Classic()
	n.UseHandler(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	n.Run(fmt.Sprintf(":%s", port))
}

type InputEvent struct {
	Button string      `json:"button"`
	Value  json.Number `json:"value"`
}

func HandleConn(w http.ResponseWriter, r *http.Request) {
	log.Println("Conn")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	input, err := NewInput("GoStick")
	if err != nil {
		log.Println(err)
		return
	}
	defer input.Close()
	log.Println("Listening")

	var ev InputEvent

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			log.Println("couldn't read: ", err)
			break
		}

		if err := json.Unmarshal(data, &ev); err != nil {
			log.Println("couldn't unmarshal: ", err)
			continue
		}

		v64, err := ev.Value.Int64()
		if err != nil {
			log.Println("couldn't get value: ", err)
			continue
		}
		var v = int(v64)

		switch ev.Button {
		case "X":
			input.SendAbs(AxisX, v)
		case "Y":
			input.SendAbs(AxisY, v)
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
			input.SendAbs(AxisY, v*-1280)
		case "back":
			input.SendAbs(AxisY, v*1280)
		case "left":
			input.SendAbs(AxisX, v*-1280)
		case "right":
			input.SendAbs(AxisX, v*1280)
		default:
			log.Println("Unhandled:" + ev.Button)
		}
	}

	log.Println("Stopped listening")
}
