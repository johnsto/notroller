"use strict";

document.body.addEventListener('touchmove', function(event) {
      event.preventDefault();
}, false); 

window.addEventListener("load", function() {
    var axis = {x: 0, y: 0},
        fuzz = 2048,
        domain = window.location.href;

    function AbsPad(el) {
        var self = this;
        this.element = el;
        this.bbox = el.getBBox();
        this.rect = el.getBoundingClientRect();
        this.value = {x: 0, y: 0};

        var nubId = el.getAttribute("data-nub");
        this.nubElement = el.ownerDocument.getElementById(nubId);
    }

    AbsPad.prototype.onEnd = function() {
        var element = this.element,
            nubElement = this.nubElement,
            value = this.value;

        element.classList.remove("on");
        nubElement.classList.remove("on");
        nubElement.setAttribute("transform", "");

        if(value.x || value.y) {
            value.x = 0;
            value.y = 0;
            postMessage({a: "x", v: value.x}, domain);
            postMessage({a: "y", v: value.y}, domain);
        }
    };

    AbsPad.prototype.onMove = function(x, y) {
        var element = this.element,
            nubElement= this.nubElement,
            rect = this.rect,
            bbox = this.bbox,
            value = this.value;

        element.classList.add("on");
        nubElement.classList.add("on");
    
        var cx = rect.left + rect.width / 2,
            cy = rect.top + rect.height / 2;
        var fx = (x - rect.left) / rect.width,
            fy = (y - rect.top) / rect.height;
        fx = Math.max(0, Math.min(1, fx));
        fy = Math.max(0, Math.min(1, fy));

        var tx = fx * bbox.width - bbox.width / 2,
            ty = fy * bbox.height - bbox.height / 2;
        
        var x = Math.round(-0x7fff + fx * 0xffff),
            y = Math.round(-0x7fff + fy * 0xffff);

        if(Math.abs(x - value.x) > fuzz) {
            value.x = x;
            postMessage({
                t: +(new Date()),
                a: "x",
                v: value.x,
            }, domain);
        }
        if(Math.abs(y - value.y) > fuzz) {
            value.y = y;
            postMessage({
                t: +(new Date()),
                a: "y",
                v: value.y,
            }, domain);
        }
        nubElement.setAttribute("transform", "translate(" + tx + "," + ty + ")");
    };

    function Button(el) {
        var self = this;
        this.value = 0;
        this.element = el;
        this.buttons = el.getAttribute("data-button").split(" ");
    };

    Button.prototype.onMove = function(x, y) {
        if(this.value == 1) {
            return;
        }
        this.value = 1;
        var element = this.element,
            buttons = this.buttons;
        element.classList.add("on");
        for(var i = 0; i < buttons.length; i++) {
            postMessage({
                t: +(new Date()),
                b: buttons[i],
                v: this.value,
            }, domain);
        }
    };

    Button.prototype.onEnd = function() {
        if(this.value == 0) {
            return;
        }
        this.value = 0;
        var element = this.element,
            buttons = this.buttons;
        element.classList.remove("on");
        for(var i = 0; i < buttons.length; i++) {
            postMessage({
                t: +(new Date()),
                b: buttons[i],
                v: this.value,
            }, domain);
        }
    };

    function Value(el) {
        var self = this;
        this.element = el;
        this.key = el.getAttribute("data-key");
    };

    Value.prototype.update = function(data) {
        var v = data[this.key];
        if(v === undefined) {
            return false;
        }
        this.element.innerHTML(v);
    };

    function requestFullscreen(el) {
        if(el.webkitRequestFullscreen) {
            return el.webkitRequestFullscreen();
        }
    };

    function exitFullscreen() {
        var el = (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement);
        if(el.webkitExitFullscreen) {
            return el.webkitExitFullscreen();
        }
    };

    function isFullscreen() {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement);
    };

    var svg = document.getElementById("svg");

    var svgDoc = svg.contentDocument;
    
    var buttons = {},
        pads = {},
        values = {};

    // hook up buttons
    var buttonEls = svgDoc.getElementsByClassName("btn");
    for(var i = 0; i < buttonEls.length; i++) {
        var el = buttonEls[i];
        if(el.id) {
            buttons[el.id] = new Button(el);
        }
    }

    // hook up pads
    var padEls = svgDoc.getElementsByClassName("pad");
    for(var i = 0; i < padEls.length; i++) {
        var el = padEls[i];
        if(el.id) {
            pads[el.id] = new AbsPad(el);
        }
    }

    // hook up values
    var valueEls = svgDoc.getElementsByClassName("value");
    for(var i = 0; i < valueEls.length; i++) {
        var el = valueEls[i];
        if(el.id) {
            values[el.id] = new Value(el);
        }
    }

    var optionEls = svgDoc.getElementsByClassName("option");
    for(var i = 0; i < optionEls.length; i++) {
        var el = optionEls[i],
            option = el.getAttribute("data-option");
        switch(option) {
            case "fullscreen":
                el.addEventListener("click", function(evt) {
                    if(isFullscreen()) {
                        exitFullscreen(svg);
                    } else {
                        requestFullscreen(svg);
                    }
                });
        }
    }
    
    var touchedIds = {};

    var onTouchMove = function(evt) {
        // Accumulate list of finger positions
        var touches = [],
            untouches = [];
        if(evt.touches) {
            // Some kind of touch event
            var evtTouches = evt.touches;
            for(var i = 0; evtTouches && i < evtTouches.length; i++) {
                var t = evtTouches[i];
                touches.push({x: t.clientX, y: t.clientY});
            }
            if(evt.type == "touchend" || evt.type == "touchcancel") {
                evtTouches = evt.changedTouches;
                for(var i = 0; evtTouches && i < evtTouches.length; i++) {
                    var t = evtTouches[i];
                    untouches.push({x: t.clientX, y: t.clientY});
                }
            }
        } else {
            // Mouse event
            switch(evt.type) {
                case "mousedown":
                case "mousemove":
                    touches.push({x: evt.clientX, y: evt.clientY});
                    break;
                case "mouseup":
                    untouches.push({x: evt.clientX, y: evt.clientY});
                    break;
            }
        }


        // Gather touched element IDs
        var nowTouchedIds = {};
        var ids = Object.keys(touchedIds);
        for(var i = 0; i < touches.length; i++) {
            var p = touches[i],
                el = svgDoc.elementFromPoint(p.x, p.y),
                id = el.id;
            nowTouchedIds[id] = true;
            if(!touchedIds[id]) {
                ids.push(id);
            }
        }

        // Mark previously active buttons
        var values = {};
        for(var id in touchedIds) {
            var button = buttons[id];
            if(button) {
                var names = button.buttons;
                button.element.classList.remove("on");
                for(var i = 0; i < names.length; i++) {
                    var name = names[i];
                    values[name] = 0; // now inactive
                }
            }
        }

        // Update values with current buttons
        for(var id in nowTouchedIds) {
            var button = buttons[id];
            if(button) {
                button.element.classList.add("on");
                var names = button.buttons;
                for(var i = 0; i < names.length; i++) {
                    var name = names[i];
                    if(values[name] == 0) {
                        values[name] = -1; // no change
                    } else {
                        values[name] = 1; // now active
                    }
                }
            }
        }

        // Send changes
        var now = +(new Date());
        for(var name in values) {
            var v = values[name];
            if(v == 0 || v == 1) {
                postMessage({
                    b: name,
                    v: v,
                    t: now,
                }, domain);
            }
        }

        touchedIds = nowTouchedIds;
    };

    svgDoc.addEventListener("touchstart", onTouchMove);
    svgDoc.addEventListener("touchmove", onTouchMove);
    svgDoc.addEventListener("touchend", onTouchMove);
    //svgDoc.addEventListener("mousedown", onTouchMove);
    //svgDoc.addEventListener("mousemove", onTouchMove);
    //svgDoc.addEventListener("mouseup", onTouchEnd);
});


(function() {
    var conn;

    var status = document.querySelectorAll(".status")[0];
    var attempts = 0;

    function connect() {
        console.log("Connecting...");

        var host = window.location.host,
            path = window.location.pathname;

        conn = new WebSocket("ws://" + host + path + "/ws");
        conn.onerror = function(evt) {
            console.error("connection error" + evt);
        };

        conn.onopen = function(evt) {
            console.log("connection opened" + evt);
            console.log("Connected.");
            attempts = 0;
            wire();
        };

        conn.onclose = function(evt) {
            if(attempts < 5) {
                attempts++;
                var delay = attempts * 100;
                console.log("Connection lost, reconnecting in " + delay + "ms...");
                setTimeout(connect, delay);
            } else {
                console.error("Disconnected after 5 retries.");
            }
        };

        conn.onmessage = function(evt) {
            var data = JSON.parse(evt.data),
                time = data.t,
                now = +(new Date());

            if(time) {
                var delta = now - time;
                console.log("lag: " + delta + "ms");
            } else {
                console.log("message: " + evt.data);
            }
        };
    };

    var throttles = {};

    function onMessage(evt) {
        console.log(evt.data);
        var data = evt.data;
        if(data.axis) {
            var throttle = throttles[data.axis] = 
                throttles[data.axis] || _.throttle(function(data) {
                conn.send(JSON.stringify(data));
            }, 20);
            throttle(data);
        } else {
            conn.send(JSON.stringify(data));
        }
    };

    function wire() {
        window.addEventListener("message", onMessage, false);
    };

    connect();
})();
