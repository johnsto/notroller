"use strict";

(function() {

    function fullscreenPresenter(element, options) {
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

        function toggleFullscreen(el) {
            if(!isFullscreen()) {
                return requestFullscreen(el);
            } else {
                return exitFullscreen(el);
            }
        };

        function isFullscreen() {
            return !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement);
        };

        element.addEventListener("click", function(evt) {
            var el = evt.target,
                fsElementId = el.getAttribute("data-fullscreen-element"),
                fsElement = document.getElementById(fsElementId);
            toggleFullscreen(fsElement);
        });
    };


})();
