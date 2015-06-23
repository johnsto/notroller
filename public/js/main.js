"use strict";

var gostick = {};

(function() {
    // getTouchPoints returns a list of points touched by the given event,
    // including radius where possible.
    var getTouchPoints = function(evt) {
        // Accumulate list of finger positions
        var rv = [];
        if(evt.touches) {
            // Some kind of touch event
            var evtTouches = evt.touches;
            for(var i = 0; evtTouches && i < evtTouches.length; i++) {
                var t = evtTouches[i];
                rv.push({
                    x: t.clientX - t.radiusX, 
                    y: t.clientY - t.radiusY,
                    w: 2 * t.radiusX,
                    h: 2 * t.radiusY,
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

    var domain = window.location.href;

    gostick.GoStick = function(options) {
        options = options || {
            element: null, // gamepad SVG element
            vibration: navigator.vibration, // vibration enabled?
            absDPad: false, // report dpad events as an absolute axis
        };

        var svg = options.element,
            svgDoc = svg.contentDocument;
        
        var widgets = {}, // map of all widgets
            touchWidgets = {}, // map of widgets that respond to touch
            orientationWidgets = {}; // map of widgets that respond to orient.

        var widgetTypes = {
            "btn": function(el, o) {
                return new gostick.ButtonWidget(el, o);
            },
            //"pad": function(el) { return null; },
            "abs": function(el, o) {
                return new gostick.AbsWidget(el, o);
            },
            "wheel": function(el, o) {
                return new gostick.WheelWidget(el, o);
            },
        };

        // Populate widgets map
        for(var className in widgetTypes) {
            var ctor = widgetTypes[className];
            var els = svgDoc.getElementsByClassName(className);
            for(var i = 0; i < els.length; i++) {
                var el = els[i];
                if(el.id) {
                    widgets[el.id] = ctor(el, options);
                }
                if(el.classList.contains("touch")) {
                    touchWidgets[el.id] = widgets[el.id];
                }
                if(el.classList.contains("orientation")) {
                    orientationWidgets[el.id] = widgets[el.id];
                }
            }
        }

        this.widgets = widgets;
        this.touchWidgets = touchWidgets;
        this.orientationWidgets = orientationWidgets;
        this.svg = svg;
        this.svgDoc = svgDoc;
        this.input = {};
    }

    // makeOrientationHandler creates and returns a handler function for
    // orientation events that triggers an update.
    gostick.GoStick.prototype.makeOrientationHandler = function() {
        var self = this,
            input = this.input;

        return function(evt) {
            input.alpha = Math.round(evt.alpha),
            input.beta = Math.round(evt.beta),
            input.gamma = Math.round(evt.gamma),

            self.onInputChanged(["alpha", "beta", "gamma"]);
        };
    };

    // makeTouchHandler creates and returns a handler function for touch
    // events that triggers an update.
    gostick.GoStick.prototype.makeTouchHandler = function() {
        var self = this,
            input = this.input;

        return function(evt) {
            var points = getTouchPoints(evt);

            input.points = points;

            self.onInputChanged(["points"]);
        };
    };

    // getTouchedWidgets returns a map of where each key is an element ID
    // touched by a point in points, and the value is a position at which
    // which the touch occured.
    function getTouchedWidgets(doc, points) {
        var rv = {};

        for(var i = 0; i < points.length; i++) {
            var p = points[i];

            // Always add element directly below touch point
            var el = doc.elementFromPoint(p.x, p.y);
            if(!el) {
                continue;
            }
            rv[el.id] = p;

            if(p.w && p.h) {
                // Find all elements within rectangular contact area
                var docEl = doc.documentElement,
                    r = d.createSVGRect();
                r.x = p.x;
                r.y = p.y;
                r.width = p.w;
                r.height = p.h;
                var els = docEl.getIntersectionList(r, null);
                for(var j = 0; j < els.length; j++) {
                    rv[els[j].id] = p;
                }
            }
        }

        return rv;
    };

    // onInputChanged is fired whenver input changes.
    // @param props - a list of property names that have changed
    gostick.GoStick.prototype.onInputChanged = function(props) {
        var self = this;
        var svg = this.svg,
            svgDoc = this.svgDoc,
            widgets = this.widgets,
            touchWidgets = this.touchWidgets,
            orientationWidgets = this.orientationWidgets,
            input = this.input;

        var state = {},
            lastState = this.lastState || {};

        // Fire touch/untouch events
        var touchedIds = getTouchedWidgets(svgDoc, input.points);
        for(var id in touchedIds) {
            var w = touchWidgets[id],
                p = touchedIds[id];
            if(!w) {
                // No widget found for this element ID?!
                continue;
            }
            if(p) {
                w.onTouch(p, state);
            } else {
                w.onUntouch(p, state);
            }
        }

        // Fire orientation events
        var ev = {
            alpha: input.alpha,
            beta: input.beta,
            gamma: input.gamma,
        };
        for(var id in orientationWidgets) {
            var w = orientationWidgets[id];
            w.onOrientation(ev, state);
        }

        // Update all widgets
        for(var id in widgets) {
            var w = widgets[id];
            w.onUpdate(state);
        }

        var keys = Object.keys(lastState);
        for(var k in state) {
            if(!lastState[k]) {
                keys.push(k);
            }
        }

        for(var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var last = lastState[k],
                curr = state[k],
                v = curr ? curr : 0;
            console.log(k, last, curr);
            if(last != curr) {
                postMessage({
                    k: k,
                    v: v,
                }, domain);
            }
        }

        this.lastState = state;
    };

    gostick.GoStick.prototype.attach = function() {
        var h = this._touchHandler = this.makeTouchHandler();
        var events = ["touchstart", "touchmove", "touchend",
                      "mousemove", "mousedown", "mouseup"];
        for(var i = 0; i < events.length; i++) {
            this.svgDoc.addEventListener(events[i], h);
        }

        var oh = this._orientationHandler = this.makeOrientationHandler();
        window.addEventListener("deviceorientation", oh);
    };

    gostick.GoStick.prototype.detach = function() {
        if(this._touchHandler) {
            var h = this._touchHandler;
            var events = ["touchstart", "touchmove", "touchend",
                          "mousemove", "mousedown", "mouseup"];
            for(var i = 0; i < events.length; i++) {
                this.svgDoc.removeEventListener(events[i], h);
            }
            this._touchHandler = null;
        }
        if(this._orientationHandler) {
            var oh = this._orientationHandler;
            window.removeEventListener("deviceorientation", oh)
            this._orientationHandler = null;
        }
    };
})();


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
