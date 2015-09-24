//main javascript
(function init() {
    // If we need to load requirejs before loading butter, make it so
    if (typeof define === "undefined") {
        var rscript = document.createElement("script");
        rscript.onload = function () {
            init();
        };
        rscript.src = "require.js";
        document.head.appendChild(rscript);
        return;
    }

    require.config({
        baseUrl: 'js/',
        paths: {
            // the left side is the module ID,
            // the right side is the path to
            // the jQuery file, relative to baseUrl.
            // Also, the path should NOT include
            // the '.js' file extension. This example
            // is using jQuery 1.8.2 located at
            // js/jquery-1.8.2.js, relative to
            // the HTML page.
            socketio: '/socket.io/socket.io'
        }
    });

    // Start the main app logic.
    define("mediascape", ["mediascape/Sharedstate/sharedstate",
                          "mediascape/Mappingservice/mappingservice"], function ($, Modules) {
        //jQuery, modules and the discovery/modules module are all
        //loaded and can be used here now.

        //creation of mediascape and discovery objects.
        var mediascape = {};
        var moduleList = Array.prototype.slice.apply(arguments);
        mediascape.init = function (options) {
            mediascapeOptions = {};
            _this = Object.create(mediascape);
            for (var i = 0; i < moduleList.length; i++) {
                var name = moduleList[i].__moduleName;
                var dontCall = ['sharedState', 'mappingService', 'applicationContext'];
                if (dontCall.indexOf(name) === -1) {
                    mediascape[name] = new moduleList[i](mediascape, "gq" + i, mediascape);
                } else {
                    mediascape[name] = moduleList[i];
                }

            }
            return _this;
        };

        mediascape.version = "0.0.1";

        // See if we have any waiting init calls that happened before we loaded require.
        if (window.mediascape) {
            var args = window.mediascape.__waiting;
            delete window.mediascape;
            if (args) {
                mediascape.init.apply(this, args);
            }
        }

        window.mediascape = mediascape;

        //return of mediascape object with discovery and features objects and its functions
        return mediascape;
    });
    require(["mediascape"], function (mediascape) {
        mediascape.init();
        /**
         *
         *  Polyfill for custonevents
         */
        (function () {
            function CustomEvent(event, params) {
                params = params || {
                    bubbles: false,
                    cancelable: false,
                    detail: undefined
                };
                var evt = document.createEvent('CustomEvent');
                evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
                return evt;
            };
            CustomEvent.prototype = window.Event.prototype;
            window.CustomEvent = CustomEvent;
        })();
        var event = new CustomEvent("mediascape-ready", {
            "detail": {
                "loaded": true
            }
        });
        document.dispatchEvent(event);
    });
}());
