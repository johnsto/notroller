"use strict";

/*gostick.AbsPad = (function() {
    function AbsPad(el, options) {
        var self = this;
        this.element = el;
        this.bbox = el.getBBox();
        this.rect = el.getBoundingClientRect();
        this.value = {x: 0, y: 0};
        this.bounds = {x: {min: -100, max: 100}, y: {min: -100, max: 100}};
        this.fuzz = 5;

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
    
        // Calculate centre point
        var cx = rect.left + rect.width / 2,
            cy = rect.top + rect.height / 2;

        // Calculate fractional X/Y values (0 (-max) -> 1 (+max))
        var fx = (x - rect.left) / rect.width,
            fy = (y - rect.top) / rect.height;
        fx = Math.max(0, Math.min(1, fx));
        fy = Math.max(0, Math.min(1, fy));

        // Calculate reported x/y axis values
        var b = this.bounds,
            x = Math.round(-b.x.min + fx * (b.x.max - b.x.min)),
            y = Math.round(-b.y.min + fy * (b.y.max - b.y.min));

        // Report X value if delta is high enough
        if(Math.abs(x - value.x) > this.fuzz) {
            value.x = x;
            postMessage({
                t: +(new Date()),
                a: "x",
                v: value.x,
            }, domain);
        }

        // Report Y value if delta is high enough
        if(Math.abs(y - value.y) > this.fuzz) {
            value.y = y;
            postMessage({
                t: +(new Date()),
                a: "y",
                v: value.y,
            }, domain);
        }

        // Calculate nub position
        var tx = fx * bbox.width - bbox.width / 2,
            ty = fy * bbox.height - bbox.height / 2;
        
        nubElement.setAttribute("transform", "translate(" + tx + "," + ty + ")");
    };

    return AbsPad;
})();*/

gostick.ButtonWidget = (function() {
    function ButtonWidget(el, options) {
        var self = this;
        this.element = el;
        this.buttons = el.getAttribute("data-button").split(" ");
        this.vibrate = options.vibrate && JSON.parse(el.getAttribute("data-vibrate"));
    };

    ButtonWidget.prototype.onTouch = function(p, state) {
        var buttons = this.buttons;
        for(var i = 0; i < buttons.length; i++) {
            var k  = buttons[i];
            state["btn:" + k] = 1;
        }
        return state;
    };

    ButtonWidget.prototype.onUntouch = function(p, state) {
        var buttons = this.buttons;
        for(var i = 0; i < buttons.length; i++) {
            var k  = buttons[i];
            if(!state["btn:" + k]) {
                state["btn:" + k] = 0;
            }
        }
        return state;
    };

    ButtonWidget.prototype.onUpdate = function(state) {
        var buttons = this.buttons,
            el = this.element,
            v = false;
        el.classList.add("on");
        for(var i = 0; i < buttons.length; i++) {
            var k = buttons[i],
                s = state["btn:" + k];
            if(!s) {
                el.classList.remove("on");
                break;
            }
            v = v || !!s;
        }

        if(this.vibrate && navigator.vibrate && !this.state && v) {
            navigator.vibrate(this.vibrate);
        }

        this.state = v;
    };

    return ButtonWidget;
})();

/*gostick.AbsWidget = (function() {
    // AbsWidget is a button that contains values for one or more absolute
    // axis.
    function AbsWidget(el, options) {
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
                if(lastState["abs:" + k] && !state["abs:" + k]) {
                    // trailing edge
                    state["abs:" + k] = 0;
                }
            }
        }
    };

    AbsWidget.prototype.readState = function(state) {
    };

    return AbsWidget;
})();*/

// WheelWidget rotates with orientation
gostick.WheelWidget = (function() {
    function WheelWidget(el, options) {
        var self = this;
        this.element = el;

        // Find configured axis
        var axis = ["x", "y", "rx", "ry"];
        this.axis = {};
        for(var i = 0; i < axis.length; i++) {
            var a = axis[i];
            var attrValue = el.getAttribute("data-axis-" + a);
            if(attrValue !== null) {
                this.axis[a] = parseInt(attrValue, 0);
            }
        };

        this.center = {
            x: parseInt(el.getAttribute("data-center-x")) || 0,
            y: parseInt(el.getAttribute("data-center-y")) || 0,
        };
    };

    WheelWidget.prototype.onOrientation = function(p, state) {
        for(var k in this.axis) {
            var v = this.axis[k];
            var f = -Math.max(Math.min(1, p.beta / 45), -1);
            state["abs:" + k] = Math.round(f * v);
        }
        return state;
    };

    WheelWidget.prototype.onUpdate = function(state) {
        var el = this.element,
            c = this.center;
        for(var k in this.axis) {
            var v = this.axis[k];
            var a = (state["abs:" + k] / v) * 45;
            var t = "rotate(" + a + "," + c.x + "," + c.y + ")";
            el.setAttribute("transform", t);
        }
    };

    return WheelWidget;
})();
