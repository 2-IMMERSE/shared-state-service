#!/usr/bin/env node

"use strict";
/**
 * MongoDB.js
 * handles the connection to MongoDB
 *
 * @author Andreas Bosl <bosl@irt.de>
 * @copyright 2014 Institut für Rundfunktechnik GmbH, All rights reserved.
 */
function MongoDB() {
    var that;

    var EventEmitter = require('events').EventEmitter;

    var config = require('../config');

    var log4js = require('log4js');
    log4js.configure(config.logConfig);
    var logger = log4js.getLogger('MongoDB');
    var crypto = require('crypto');
    var promise = require('promise');
    require('promise/lib/rejection-tracking').enable();

    var db = null;

    var stateModels = {};
    var userModel = {};
    var appModel = {};
    var userAppModel = {};
    var groupModel = {};
    var usedIds = [];

    var userCollect = false;
    var appCollect = false;
    var userAppCollect = false;
    var groupCollect = false;

    if (!config.mongoose) config.mongoose = {};
    config.mongoose.promiseLibrary = promise;

    function init() {
        db = require('mongoose');
        db.Promise = promise;

        db.connection.on('error', function (error) {
            logger.error('Couldn\'t connect to DB: ', error.name, error.message);
            logger.error('terminating');
            process.exit(1);
        });
        db.connection.once('open', function () {
            logger.info('Connection to DB established');
        });

        db.connect(config.mongoose.uri, config.mongoose.options);

        var safe = {
            w: 0,
            wtimeout: 10000
        };

        var userSchema = new db.Schema({
            userId: {
                type: String,
                unique: true
            },
            service: {
                type: String,
                unique: true
            }
        }, {
            safe: safe
        });

        var appSchema = new db.Schema({
            appId: {
                type: String,
                unique: true
            },
            service: {
                type: String,
                unique: true
            }
        }, {
            safe: safe
        });

        var userAppSchema = new db.Schema({
            userId: {
                type: String

            },
            appId: {
                type: String
            },
            service: {
                type: String,
                unique: true
            }
        }, {
            safe: safe
        });

        var groupSchema = new db.Schema({
            groupId: {
                type: String,
                unique: true
            },
            service: {
                type: String,
                unique: true
            }
        }, {
            safe: safe
        });

        userModel = db.model(config.mappingPath + '_user', userSchema);
        appModel = db.model(config.mappingPath + '_app', appSchema);
        userAppModel = db.model(config.mappingPath + '_appUser', userAppSchema);
        groupModel = db.model(config.mappingPath + '_group', groupSchema);

        collectServices();
    };

    function collectServices() {
        userModel.find({}, function (err, docs) {
            if (err) {
                logger.error('collectServices: (userModel.find)', err);
            } else {
                for (var i = 0, len = docs.length; i < len; i++) {
                    usedIds.push(docs[i].service);
                }
            }
            userCollect = true;
            createPathes();
        });
        appModel.find({}, function (err, docs) {
            if (err) {
                logger.error('collectServices: (appModel.find)', err);
            } else {
                for (var i = 0, len = docs.length; i < len; i++) {
                    usedIds.push(docs[i].service);
                }
            }
            appCollect = true;
            createPathes();
        });
        userAppModel.find({}, function (err, docs) {
            if (err) {
                logger.error('collectServices: (userAppModel.find)', err);
            } else {
                for (var i = 0, len = docs.length; i < len; i++) {
                    usedIds.push(docs[i].service);
                }
            }
            userAppCollect = true;
            createPathes();
        });
        groupModel.find({}, function (err, docs) {
            if (err) {
                logger.error('collectServices: (groupModel.find)', err);
            } else {
                for (var i = 0, len = docs.length; i < len; i++) {
                    usedIds.push(docs[i].service);
                }
            }
            groupCollect = true;
            createPathes();
        });
    };

    function createPathes(newPath) {
        if (newPath) {
            var stateSchema = new db.Schema({
                key: {
                    type: String,
                    unique: true
                },
                value: db.Schema.Types.Mixed
            }, {
                safe: {
                    w: 0,
                    wtimeout: 10000
                }
            });

            stateModels[newPath] = db.model(newPath, stateSchema);
        } else {
            if (userCollect && appCollect && userAppCollect && groupCollect) {
                for (var i = 0, len = usedIds.length; i < len; i++) {
                    var stateSchema = new db.Schema({
                        key: {
                            type: String,
                            unique: true
                        },
                        value: db.Schema.Types.Mixed
                    }, {
                        safe: {
                            w: 0,
                            wtimeout: 10000
                        }
                    });

                    stateModels[usedIds[i]] = db.model(usedIds[i], stateSchema);
                }
                that.emit('newPath', usedIds);
            }
        }
    };

    function getState(path, data, callback) {
        var datagram = [];
        if (data.length == 0) {
            stateModels[path].find({}, function (err, docs) {
                if (err) {
                    logger.error('DB-Error (getState 1)', err);
                } else {
                    for (var i = 0; i < docs.length; i++) {
                        var state = {};
                        state.type = 'set';
                        state.key = docs[i].key;
                        state.value = docs[i].value;
                        datagram.push(state);
                    }
                    callback(datagram);
                }
            });
        } else {
            var keys = [];
            for (var i = 0; i < data.length; i++) {
                keys.push(data.changeState[i].key);
            }

            stateModels[path].find({
                    key: {
                        $in: keys
                    }
                },
                function (err, docs) {
                    if (err) {
                        logger.error('DB-Error (getState 2)', err);
                    } else {
                        for (var i = 0; i < docs.length; i++) {
                            var state = {};
                            state.type = 'set';
                            state.key = docs[i].key;
                            state.value = docs[i].value;
                            datagram.push(state);
                        }
                        callback(datagram);
                    }
                });
        }
    };

    function changeState(path, data, completion) {
        if (data && data.length && path) {
            var pending = data.length;
            var done = function() {
                pending--;
                if (pending === 0) {
                    completion();
                }
            };
            for (var i = 0; i < data.length; i++) {
                var element = data[i];

                (function (cElement) {
                    if (cElement.type == 'set') {
                        stateModels[path].update({
                            key: cElement.key
                        }, {
                            $set: {
                                value: cElement.value
                            }
                        }, {
                            upsert: true
                        }, function (err, result) {
                            if (err) {
                                logger.error('DB-Error (set)', err);
                            } else if (result.upserted || result.nUpserted || result.nModified) {
                                onChanged(path, cElement);
                            }
                            done();
                        });
                    } else if (cElement.type == 'remove') {
                        stateModels[path].findOne({
                            key: cElement.key
                        }, function (err, doc) {
                            if (err) {
                                logger.error('DB-Error', err);
                            } else if (doc) {
                                doc.remove(function (err) {
                                    if (err) {
                                        logger.error('DB-Error (remove)', err);
                                    } else {
                                        onRemoved(path, doc);
                                    }
                                });
                            }
                            done();
                        });
                    } else if (cElement.type == 'setInsert') {
                        stateModels[path].update({
                            key: cElement.key
                        }, {
                            $setOnInsert: {
                                value: cElement.value
                            }
                        }, {
                            upsert: true
                        }, function (err, result) {
                            if (err) {
                                logger.error('DB-Error (setInsert)', err);
                            } else {
                                if (result.upserted) {
                                    onChanged(path, cElement);
                                }
                            }
                            done();
                        });
                    } else if (cElement.type == 'setCas') {
                        stateModels[path].findOneAndUpdate({
                            key: cElement.key,
                            value: cElement.oldValue,
                        }, {
                            $set: {
                                value: cElement.value
                            }
                        }, {
                            upsert: false
                        }, function (err, result) {
                            if (err) {
                                logger.error('DB-Error (setCas)', err);
                            } else if (result) {
                                onChanged(path, cElement);
                            }
                            done();
                        });
                    } else {
                        logger.error('DB-Error: unexpected operation type: ' + cElement.type);
                        done();
                    }
                })(element);
            }
        } else {
            completion();
        }
    };

    function getUserMapping(request, callback) {
        var scopes = {};
        userModel.findOne({
            userId: request.userId
        }, function (err, doc) {
            if (err) {
                logger.error("getUserMapping: DB error (1): ", err);
                callback({ "error": "getUserMapping: DB error (1): " + err });
            } else {
                if (doc) {
                    scopes.user = doc.service;
                }
                appModel.findOne({
                    appId: request.appId
                }, function (err, doc) {
                    if (err) {
                        logger.error("getUserMapping: DB error (2): ", err);
                        callback({ "error": "getUserMapping: DB error (2): " + err });
                    } else {
                        if (doc) {
                            scopes.app = doc.service;
                        }
                        userAppModel.findOne({
                            userId: request.userId,
                            appId: request.appId
                        }, function (err, doc) {
                            if (err) {
                                logger.error("getUserMapping: DB error (3): ", err);
                                callback({ "error": "getUserMapping: DB error (3): " + err });
                            } else {
                                if (doc) {
                                    scopes.userApp = doc.service;
                                }
                                checkMappings(request, scopes, callback);
                            }
                        });
                    }
                });
            }
        });
    };

    function getGroupMapping(request, callback) {
        var scopes = {};
        groupModel.findOne({
            groupId: request.groupId
        }, function (err, doc) {
            if (err) {
                logger.error("getGroupMapping: DB error: ", err);
                callback({ "error": "getGroupMapping: DB error: " + err });
            } else {
                if (doc) {
                    scopes.group = doc.service;
                }
                checkMappings(request, scopes, callback);
            }
        });
    };

    function checkMappings(request, scopes, callback) {
        var completion = callback.bind(null, request);
        if (request.user) {
            if (scopes.user) {
                request.user = scopes.user;
                completion();
            } else {
                request.user = createServiceID();
                usedIds.push(request.user);
                that.emit('newPath', request.user);
                createPathes(request.user);
                var newUserModel = new userModel();
                newUserModel.userId = request.userId;
                newUserModel.service = request.user;
                newUserModel.save(completion);
            }
        }
        if (request.app) {
            if (scopes.app) {
                request.app = scopes.app;
                completion();
            } else {
                request.app = createServiceID();
                usedIds.push(request.app);
                that.emit('newPath', request.app);
                createPathes(request.app);
                var newAppModel = new appModel();
                newAppModel.appId = request.appId;
                newAppModel.service = request.app;
                newAppModel.save(completion);
            }
        }
        if (request.userApp) {
            if (scopes.userApp) {
                request.userApp = scopes.userApp;
                completion();
            } else {
                request.userApp = createServiceID();
                usedIds.push(request.userApp);
                that.emit('newPath', request.userApp);
                createPathes(request.userApp);
                var newUserAppModel = new userAppModel();
                newUserAppModel.userId = request.userId;
                newUserAppModel.appId = request.appId;
                newUserAppModel.service = request.userApp;
                newUserAppModel.save(completion);
            }
        }
        if (request.groupId) {
            if (scopes.group) {
                request.group = scopes.group;
                completion();
            } else {
                request.group = createServiceID();
                usedIds.push(request.group);
                that.emit('newPath', request.group);
                createPathes(request.group);
                var newGroupModel = new groupModel();
                newGroupModel.groupId = request.groupId;
                newGroupModel.service = request.group;
                newGroupModel.save(completion);
            }
        }
    }


    function checkAllowed(path, data, callback) {
        var ids = {};
        userModel.findOne({
            service: path
        }, function (err, doc) {
            if (err) {
                logger.error(err);
            } else {
                if (doc) {
                    ids.user = doc.userId;
                }
                appModel.findOne({
                    service: path
                }, function (err, doc) {
                    if (err) {
                        logger.error(err);
                    } else {
                        if (doc) {
                            ids.app = doc.appId;
                        }
                        userAppModel.findOne({
                            service: path
                        }, function (err, doc) {
                            if (err) {
                                logger.error(err);
                            } else {
                                if (doc) {
                                    ids.userApp = doc.userId;
                                }
                                groupModel.findOne({
                                    service: path
                                }, function (err, doc) {
                                    if (err) {
                                        logger.error(err);
                                    } else {
                                        if (doc) {
                                            ids.group = doc.groupId;
                                        }
                                        if (ids.app || ids.group) {

                                            if (ids.group) {
                                                callback(true, true);
                                            } else {
                                                callback(true);
                                            }
                                        } else {
                                            if (ids.user) {
                                                if (ids.user === data.userId) {
                                                    callback(true);
                                                } else {
                                                    callback(false, false, "Wrong userId: " + ids.user + " !== " + data.userId);
                                                }
                                            } else {
                                                if (ids.userApp) {
                                                    if (ids.userApp === data.userId) {
                                                        callback(true);
                                                    } else {
                                                        callback(false, false, "Wrong userApp: " + ids.userApp + " !== " + data.userId);
                                                    }
                                                } else {
                                                    callback(false, false, "No userId or userApp");
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }


    function createServiceID() {
        var found = true;
        var id;
        do {
            id = crypto.randomBytes(10).toString('hex');
            if (usedIds.indexOf(id) == -1) {
                found = false;
            }
        } while (found);
        return id;
    };


    function onChanged(path, doc) {
        var datagram = [{
                type: 'set',
                key: doc.key,
                value: doc.value
            }];
        that.emit('changeState', path, datagram);
    };

    function onRemoved(path, doc) {
        var datagram = [{
                type: 'remove',
                key: doc.key,
                value: null
            }];
        that.emit('changeState', path, datagram);
    };

    init();

    that = {
        getState: getState,
        changeState: changeState,
        getUserMapping: getUserMapping,
        getGroupMapping: getGroupMapping,
        checkAllowed: checkAllowed
    };

    that.__proto__ = EventEmitter.prototype;

    return that;
}

module.exports = MongoDB;
