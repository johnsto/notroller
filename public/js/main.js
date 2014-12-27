"use strict";

document.body.addEventListener('touchmove', function(event) {
      event.preventDefault();
}, false); 

window.addEventListener("load", function() {
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

    function ButtonWidget(el) {
        var self = this;
        this.element = el;
        this.buttons = el.getAttribute("data-button").split(" ");
    };

    ButtonWidget.prototype.putState = function(lastState, state, p) {
        var buttons = this.buttons,
            el = this.element;
        if(p) {
            for(var i = 0; i < buttons.length; i++) {
                var k  = buttons[i];
                state["btn:" + k] = 1;
            }
        } else {
            for(var i = 0; i < buttons.length; i++) {
                var k  = buttons[i];
                if(lastState["btn:" + k] && !state["btn:" + k]) {
                    state["btn:" + k] = 0;
                }
            }
        }
    };

    ButtonWidget.prototype.readState = function(state) {
        var buttons = this.buttons,
            el = this.element;
        el.classList.add("on");
        for(var i = 0; i < buttons.length; i++) {
            var k = buttons[i],
                s = state["btn:" + k];
            if(!s) {
                el.classList.remove("on");
                return;
            }
        }
    };
    
    // AbsWidget is a button that contains values for one or more absolute
    // axis.
    function AbsWidget(el) {
        var self = this;
        this.element = el;

        // Read values for all known axis
        var axis = ["x", "y", "rx", "ry"];
        this.axis = {};
        for(var i = 0; i < axis.length; i++) {
            var a = axis[i];
            var attrValue = el.getAttribute("data-axis-" + a);
            if(attrValue !== null) {
                this.axis[a] = parseInt(attrValue, 0);
            }
        };
    };

    AbsWidget.prototype.putState = function(lastState, state, p) {
        var axis = this.axis,
            el = this.element;
        if(p) {
            el.classList.add("on");
            for(var k in axis) {
                if(!state["abs:" + k]) {
                    state["abs:" + k] = 0;
                }
                state["abs:" + k] += axis[k];
            }
        } else {
            el.classList.remove("on");
            for(var k in axis) {
                if(lastState["abs:" + k]  && !state["abs:" + k]) {
                    state["abs:" + k] = 0;
                }
            }
        }
    };

    AbsWidget.prototype.readState = function(state) {
    };
    
    // ValueWidget
    function ValueWidget(el) {
        var self = this;
        this.element = el;
        this.key = el.getAttribute("data-key");
    };

    ValueWidget.prototype.clearState = function(lastState, state, p) {
    };

    ValueWidget.prototype.putState = function(data, p) {
    };

    ValueWidget.prototype.readState = function(state) {
    };

    var svg = document.getElementById("svg"),
        svgDoc = svg.contentDocument;
    
    var widgets = {};

    var widgetTypes = {
        "btn": function(el) { return new ButtonWidget(el); },
        //"pad": function(el) { return null; },
        "value": function(el) { return new ValueWidget(el); },
        "abs": function(el) { return new AbsWidget(el); },
        //"option": function(el) { return null },
    };

    // Populate widgets map
    for(var className in widgetTypes) {
        var ctor = widgetTypes[className];
        var els = svgDoc.getElementsByClassName(className);
        for(var i = 0; i < els.length; i++) {
            var el = els[i];
            if(el.id) {
                widgets[el.id] = ctor(el);
            }
        }
    }

    // getTouchPoints returns a list of points touched by the given event.
    var getTouchPoints = function(evt) {
        // Accumulate list of finger positions
        var rv = [];
        if(evt.touches) {
            // Some kind of touch event
            var evtTouches = evt.touches;
            for(var i = 0; evtTouches && i < evtTouches.length; i++) {
                var t = evtTouches[i];
                console.log(t.radiusX, t.radiusY, t.force);
                rv.push({
                    x: t.clientX - t.radiusX / 2, 
                    y: t.clientY - t.radiusY / 2,
                    w: t.radiusX,
                    h: t.radiusY,
                });
            }
        } else {
            // Mouse event
            switch(evt.type) {
                case "mousedown":
                case "mousemove":
                    if(evt.which) {
                        rv.push({
                            x: evt.clientX,
                            y: evt.clientY,
                        });
                    }
                    break;
            }
        }
        return rv;
    };


    var lastState = {};
    var onTouchMove = function(evt) {
        var points = getTouchPoints(evt);
        var state = {};

        // Iterate through touch points
        var touched = {};
        for(var i = 0; i < points.length; i++) {
            var p = points[i];

            var el = svgDoc.elementFromPoint(p.x, p.y);
            touched[el.id] = p;

            if(p.w && p.h) {
                // Find all elements within contact area
                var d = svgDoc.documentElement,
                    r = d.createSVGRect();
                r.x = p.x;
                r.y = p.y;
                r.width = p.w;
                r.height = p.h;
                var els = d.getIntersectionList(r, null);
                for(var i = 0; i < els.length; i++) {
                    touched[els[i].id] = p;
                }
            }
        }

        for(var id in widgets) {
            var widget = widgets[id];
            if(!widget) {
                continue;
            }
            var p = touched[id];
            widget.putState(lastState, state, touched[id]);
        }

        for(var id in widgets) {
            var widget = widgets[id];
            widget.readState(state);
        }

        var now = +(new Date());
        for(var k in state) {
            var v = state[k];
            if(state[k] != lastState[k]) {
                postMessage({
                    k: k,
                    v: v,
                    t: now,
                }, domain);
            }
        }

        lastState = state;
    };

    svgDoc.addEventListener("touchstart", onTouchMove);
    svgDoc.addEventListener("touchmove", onTouchMove);
    svgDoc.addEventListener("touchend", onTouchMove);
    svgDoc.addEventListener("mousemove", onTouchMove);
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
        conn.send(JSON.stringify(data));
    };

    function wire() {
        window.addEventListener("message", onMessage, false);
    };

    connect();
})();
