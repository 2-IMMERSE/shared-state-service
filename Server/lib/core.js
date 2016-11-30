#!/usr/bin/env node

"use strict";

/**
 * MediaScape SharedState - core.js
 * Main entrance point
 *
 * @author Andreas Bosl <bosl@irt.de>
 * @copyright 2014 Institut für Rundfunktechnik GmbH, All rights reserved.
 */

function Core() {


    var config = require('../config');

    var log4js = require('log4js');
    log4js.configure(config.logConfig);
    var logger = log4js.getLogger('core');


    var db = null;
    var connectors = [];
    var MySocketsServer = {};
    var groupMappingRequestsInFlight = {};
    var userMappingRequestsInFlight = {};

    setupDBConnection();
    setupClientConnection();


    function setupDBConnection() {
        if (config.db) {
            var connector = require(config.db.file);
            db = connector();

            db.on('removeState', sendRemoveState);

            db.on('changeState', sendChangeState);

            db.on('newPath', onNewPath);
        }
    };

    function setupClientConnection() {

        var ExpressServer = require('./ExpressServer.js');
        var MyExpressServer = ExpressServer();

        var SocketServer = require('./SocketServer.js');
        MySocketsServer = SocketServer(MyExpressServer.getServer());

        MySocketsServer.on('getState', onGetState);

        MySocketsServer.on('changeState', onChangeState);

        MySocketsServer.on('join', onJoin);

        MySocketsServer.on('getMapping', onGetMapping);
    };

    function mappingSerialise(obj, key, handler, completion) {
        var pending = obj[key];
        var callback = function() {
            completion.apply(this, arguments);
            if (pending.length) {
                pending.shift()();
            } else {
                delete obj[key];
            }
        };
        if (pending) {
            pending.push(handler.bind(null, callback));
        } else {
            pending = obj[key] = [];
            handler(callback);
        }
    }

    function onGetMapping(request, callback) {
        if (request.userId && request.appId) {
            return mappingSerialise(userMappingRequestsInFlight, request.userId + "|" + request.appId, db.getUserMapping.bind(db, request), callback);
        } else {
            if (request.groupId) {
                return mappingSerialise(groupMappingRequestsInFlight, 'group:' + request.groupId, db.getGroupMapping.bind(db, request), callback);
            }
        }
        logger.warn("onGetMapping: Negatively acknowledging invalid request: " + JSON.stringify(request));
        callback({ error: "invalid mapping request (2)" });
    };


    function onChangeState(path, data) {
        if (db) {
            db.changeState(path, data);
        } else {
            logger.error('No DB connected?')
        }
    };


    function onGetState(path, data, callback) {
        if (db) {
            db.getState(path, data, callback);
        } else {
            logger.error('No DB connected?')
        }
    };

    function onJoin(path, data, callback) {
        db.checkAllowed(path, data, callback);
    };



    function sendRemoveState(path, data) {
        MySocketsServer.removeState(path, data);
    };

    function sendChangeState(path, data) {
        MySocketsServer.changeState(path, data);
    };

    function onNewPath(path) {
        MySocketsServer.createNSP(path);
    }
}

module.exports = Core;
