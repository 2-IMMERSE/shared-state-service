#!/usr/bin/env node

"use strict";

/**
 * MediaScape SharedState - SocketServer.js
 * Enable the Socket connection
 *
 * @author Andreas Bosl <bosl@irt.de>
 * @copyright 2014 Institut für Rundfunktechnik GmbH, All rights reserved.
 */

var capabilities = {
    changeStateAck: true,
};

function SocketServer(server) {
    var that;

    var EventEmitter = require('events').EventEmitter;

    var config = require('../config');

    var log4js = require('log4js');
    log4js.configure(config.logConfig);
    var logger = log4js.getLogger('SocketServer');

    var io = require('socket.io')(server);


    var cookieParser = require('cookie-parser');
    var session = require('express-session');
    var sessionStore = require('connect-mongo')(session);
    var passportSocketIo = require("passport.socketio");

    var nameSpaces = {};

    var noop = function() { };


    io.use(passportSocketIo.authorize({
        cookieParser: cookieParser,
        key: config.auth.session_name, // the name of the cookie where express/connect stores its session_id
        secret: config.auth.session_secret, // the session_secret to parse the cookie
        store: new sessionStore({
            url: config.mongoose.uri + 'session'
        }), // we NEED to use a sessionstore. no memorystore please
        success: onAuthorizeSuccess, // *optional* callback on success - read more below
        fail: onAuthorizeFail, // *optional* callback on fail/error - read more below
    }));

    function onAuthorizeSuccess(data, accept) {
        logger.info('accepted', data.user.displayName);
        accept();
    }

    function onAuthorizeFail(data, message, error, accept) {
        logger.info('User accepted without authentication', message);
        accept();

        // error indicates whether the fail is due to an error or just a unauthorized client
        // if (error) throw new Error(message);
        // send the (not-fatal) error-message to the client and deny the connection
        // return accept(new Error(message));
    }

    function init() {
        io.on('connection', function (socket) {
            socket.on('getMapping', function (request, ack) {
                logger.debug("GetMapping: " + JSON.stringify(request) + ", ack: " + !!ack);
                var completion = function (response) {
                    // Optional unique token to aid debugging
                    if (request.token) response.token = request.token;

                    logger.debug("GetMapping completion: " + JSON.stringify(request) + ", ack: " + !!ack + ", --> " + JSON.stringify(response));
                    if (typeof ack === "function") {
                        ack(response);
                    } else {
                        socket.emit('mapping', response);
                    }
                };
                if (!config.auth.useAuthentication) {
                    if (request.userId || (request.groupId && !request.appId)) {
                        return that.emit('getMapping', request, completion);
                    }
                } else {
                    if (socket.request.user.logged_in && socket.request.user.id) {
                        request.userId = socket.request.user.id;
                        return that.emit('getMapping', request, completion);
                    } else {
                        if (request.groupId && !request.appId) {
                            return that.emit('getMapping', request, completion);
                        }
                    }

                }
                logger.warn("Negatively acknowledging GetMapping request: " + JSON.stringify(request) + ", ack: " + !!ack);
                completion({ error: "invalid mapping request (1)" });
            });
        });
    }

    function createNameSpace(path) {
        var nsp = io.of('/' + path);

        logger.info('created nsp with', path);
        var clients = {};
        var allowedUsers = [];

        nsp.on('connection', function (socket) {

            var thisIsGroup = false;

            socket.on('join', onJoin);
            socket.on('disconnect', onDisconnect);
            socket.on('changePresence', onChangePresence);
            socket.on('getState', onGetState);
            socket.on('changeState', onChangeState);
            socket.on('getInitState', onGetInitState);

            function onGetInitState(data) {
                if (checkIfAllowed()) {
                    that.emit('getState', path, data, function (datagram) {
                        logger.debug('onGetInitState: Sending initial data for: "' + path + '"');
                        sendPrivate('initState', datagram);
                    });
                } else {
                    sendPrivate('ssError', 'not logged in');
                }
            };

            function onJoin(data) {
                logger.debug('onJoin: Somebody wants to join: "' + path + '", with: ' + JSON.stringify(data));
                if (config.auth.useAuthentication) {
                    data.userId = socket.request.user.id;
                }
                that.emit('join', path, data, function (allowed, isGroup, reason) {
                    logger.info("onJoin callback: " + JSON.stringify({
                        path: path,
                        data: data,
                        allowed: allowed,
                        isGroup: isGroup,
                        reason: reason,
                    }));
                    if (allowed) {
                        socket.MSagentID = data.agentID;
                        socket.MSpresence = 'connected';
                        allowedUsers.push(socket.request.user.id);
                        clients[socket.id] = socket;
                        if (data.sendInitState) {
                            that.emit('getState', path, [], function (datagram) {
                                logger.debug('onJoin: Sending initial data for: "' + path + '"');
                                sendPrivate('initState', datagram);
                            });
                            data.initStateComing = true;
                        }
                        sendPrivate('joined', data);
                        sendPrivate('capabilities', capabilities);
                        if (isGroup) {
                            thisIsGroup = true;
                        }
                        doStatus();
                        doUpdateStatus(socket);
                    } else {
                        sendPrivate('ssError', 'not allowed to join due to: ' + reason);
                    }
                });
            };

            function onDisconnect() {
                if (allowedUsers.indexOf(socket.request.user.id) >= 0) {
                    allowedUsers.splice(allowedUsers.indexOf(socket.request.user.id), 1);
                }
                if (clients[socket.id]) {
                    delete clients[socket.id];
                    doUpdateStatus(socket.MSagentID);
                }
            };

            function onChangePresence(data) {
                if (checkIfAllowed()) {
                    if (data.agentID == socket.MSagentID) {
                        socket.MSpresence = data.presence;
                        doUpdateStatus(socket);
                    } else {
                        sendPrivate('ssError', 'wrong AgentID??');
                    }
                } else {
                    sendPrivate('ssError', 'not logged in');
                }
            };

            function onGetState(data) {
                if (checkIfAllowed()) {
                    doGetState(data);
                } else {
                    sendPrivate('ssError', 'not logged in');
                }
            };

            function onChangeState(data, ack) {
                var completion = (typeof ack === "function") ? ack : noop;
                if (checkIfAllowed()) {
                    doChangeState(data, completion);
                } else {
                    sendPrivate('ssError', 'not logged in');
                    completion();
                }
            };

            function doStatus() {
                if (checkIfAllowed()) {
                    var clientKeys = Object.keys(clients);
                    var statusInfo = {
                        clients: clientKeys.length,
                        presence: []
                    };
                    for (var i = 0; i < clientKeys.length; i++) {
                        var clientstatus = {
                            key: clients[clientKeys[i]].MSagentID,
                            value: clients[clientKeys[i]].MSpresence
                        };
                        statusInfo.presence.push(clientstatus);
                    }

                    sendPrivate('status', statusInfo);
                }
            };

            function doUpdateStatus(theSocket) {
                if (checkIfAllowed()) {
                    var clientKeys = Object.keys(clients);

                    var statusInfo = {
                        clients: clientKeys.length,
                        presence: []
                    };

                    if (typeof theSocket == 'string') {
                        statusInfo.presence = [{
                            key: theSocket,
                            value: 'offline'
                        }];
                    } else {
                        statusInfo.presence = [{
                            key: theSocket.MSagentID,
                            value: theSocket.MSpresence
                        }];
                    }

                    sendAll('status', statusInfo);
                } else {
                    sendPrivate('ssError', 'not logged in');
                }
            };

            function doGetState(data) {
                that.emit('getState', path, data, function (datagram) {
                    sendPrivate('changeState', datagram);
                });
            };

            function doChangeState(data, completion) {
                that.emit('changeState', path, data, completion);
            };

            function sendPrivate(event, msg) {
                socket.emit(event, msg);
            };

            function sendAll(event, msg) {
                nsp.emit(event, msg);
            }

            function checkIfAllowed() {
                if (thisIsGroup) {
                    return true;
                }
                if ((socket.request.user.logged_in && socket.request.user.id) || !config.auth.useAuthentication) {
                    if (allowedUsers.indexOf(socket.request.user.id) >= 0) {
                        return true;
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            nsp.sendALL = sendAll;
        });

        nameSpaces[path] = nsp;
    };

    function createNSP(pathes) {
        if (Array.isArray(pathes)) {
            for (var i = 0, len = pathes.length; i < len; i++) {
                createNameSpace(pathes[i]);
            }
        } else {
            createNameSpace(pathes);
        }
    };

    function changeState(path, data) {
        nameSpaces[path].sendALL('changeState', data);
    };

    that = {
        changeState: changeState,
        createNSP: createNSP
    };

    init();

    that.__proto__ = EventEmitter.prototype;

    return that;
}

module.exports = SocketServer;
