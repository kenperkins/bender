var async = require('async'),
    Bender = require('../bender'),
    colors = require('colors'),
    ping = require('ping'),
    repl = require('repl'),
    Table = require('easy-table'),
    _ = require('underscore');

require('date-utils');

colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'green',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
});

var REPL = exports.REPL = function(config) {

    if (process.env.USER !== 'root') {
        console.log('Please run as sudo or root');
        process.exit(1);
        return;
    }

    var self = this;

    if (!config) {
        throw new Error('config is required to create a Bender-REPL');
    }

    console.log('\nBender'.bold.yellow);
    console.log('  The server/service management app from Clipboard\n'.data);

    self.config = config;

    self.initialize(function() {
        self.repl = repl.start({
            prompt: self.getPrompt(),
            input: process.stdin,
            output: process.stdout,
            terminal: true,
            useColors: true,
            writer: function(obj) {
                if (!obj) {
                    return '';
                }

                return obj.yellow + '\n';
            },
            eval: function(cmd, context, filename, callback) {
                dispatch(cmd, callback);
            }
        });
    });


    function dispatch(cmd, callback) {

        cmd = cmd.substr(1, cmd.length - 2);

        var commands = cmd.split('\n')[0].split(' ');

        if (!commands) {
            callback();
            return;
        }

        switch (commands[0].toLowerCase()) {
            case '':
                callback(null, new Date().toUTCString());
                break;
            case 'env':
                if (commands.length === 1) {
                    self.displayEnvironments(callback);
                }
                else if (commands.length === 2) {
                    self.setEnvironmentByName(commands[1], callback);
                }
                break;
            case 'status':
                if (commands.length === 1) {
                    self.displayStatus(callback);
                }
                break;
            case 'ping':
                self.ping(callback);
                break;
            case 'list':
                self.list(callback);
                break;
            case 'services':
                self.displayServices(callback);
                break;
            case 'help':
                callback();
                break;
            case 'exit':
                process.exit(0);
                break;
            default:
                callback();
        }
    }
};

var core = {
    initialize: function(callback) {
        var self = this;

        var cfg = {
            logLevel : 'verbose',
            fileLog: true
        };

        console.log('Initializing Bender REPL...'.cyan);
        Bender.createClient(_.extend({}, cfg, self.config), function(err, bender) {
            if (err || !bender) {
                console.error('Unable to initialize bender'.bold.red, err);
                process.exit(1);
            }

            self.bender = bender;
            self.log = bender.log;

            self.loadEnvironments(function(err) {
                if (err) {
                    self.log.error('Unable to load environments', err);
                    callback(err);
                    return;
                }

                self.setEnvironmentByName('mgmt', callback);
            });

        });
    },

    ping: function(callback) {
        var self = this;

        self.bender.getServersForEnvironment(self.currentEnvironment.id, function(err, servers) {
            if (err) {
                callback(err, 'Unable to get servers');
                return;
            }

            var data = [];

            async.forEachLimit(servers, 10, function(server, next) {
                ping.sys.probe(server.getPrivateIp(), function(isAlive) {
                    data.push({
                        name: server.name,
                        status: isAlive ? 'UP' : 'DOWN'
                    });
                    next();
                });
            }, function(err) {
                var t = new Table;

                data.forEach(function(product) {
                    t.cell('Name', product.name);
                    t.cell('Status', product.status);
                    t.newRow();
                });

                callback(null, t.toString());
            });
        });
    },



    list: function(callback) {
        var self = this;

        self.bender.getServersForEnvironment(self.currentEnvironment.id, function(err, servers) {
            if (err) {
                callback(err, 'Unable to get servers');
                return;
            }

            var message = '';

            _.each(servers, function(server) {
                message += server.name.yellow + '\n';
            });

            callback(null, message);
        });
    },

    setEnvironment: function(env, callback) {
        var self = this;

        self.currentEnvironment = env;

        callback();
    },

    setEnvironmentByName: function(name, callback) {
        var self = this;

        _.each(self.environments, function(env) {
            if (env.name === name) {
                self.setEnvironment(env, function(err) {
                    if (err) {
                        callback(err, 'Unable to set environment to: ' + name);
                    }
                    else {
                        self.repl && (self.repl.prompt = self.getPrompt());
                        callback(err, 'Environment set to: ' + name);
                    }
                });
            }
        });
    },

    getPrompt: function() {
        var self = this;
        return 'Bender [' + self.currentEnvironment.name + '] > ';
    },

    loadEnvironments: function(callback) {
        var self = this;

        self.bender.getEnvironments(function(err, envs) {
            if (err) {
                self.log.error('Unable to load environments', err);
                callback(err);
                return;
            }

            self.environments = envs;
            callback();
        });
    },

    displayEnvironments: function(callback) {
        var self = this;

        self.bender.getEnvironments(function(err, envs) {
            if (err) {
                self.log.error('Unable to load environments', err);
                callback(err);
                return;
            }

            callback(null, _.map(envs, function(env) {
                return env.name;
            }).join(' '));
        });
    },

    displayServices: function(callback) {
        var self = this;

        self.bender.getServices(function(err, services) {
            if (err) {
                self.log.error('Unable to load services', err);
                callback(err);
                return;
            }

            var data = [];

            _.each(services, function(service) {
                data.push({
                    name: service.name,
                    serviceName: service.serviceName,
                    type: service.type,
                    doesReload: service.doesReload
                });
            });

            var t = new Table;

            data.forEach(function(product) {
                t.cell('Name', product.name);
                t.cell('Service', product.serviceName);
                t.cell('Type', product.type);
                t.cell('Reload?', product.doesReload);
                t.newRow();
            });

            callback(null, t.toString());
        });
    },

    displayStatus: function(callback) {
        self.bender.getServersForEnvironment(function(err, servers) {
            if (err) {
                self.log.error('Unable to load servers', err);
                callback(err);
                return;
            }

            var services = [], data = [];

            async.forEachLimit(servers, 10, function(server, next) {
                server.getServices().done(function(err, svcs) {
                    if (err) {
                        next(err);
                        return;
                    }

                    _.each(svcs, function(service) {
                         services.push({
                             server: server,
                             service: service
                         });
                    });

                    next();
                });
            }, function(err) {
                async.forEachLimit(services, 10, function(service, next) {

                }, function(err) {

                });
            });

            _.each(services, function(service) {
                data.push({
                    name: service.name,
                    serviceName: service.serviceName,
                    type: service.type,
                    doesReload: service.doesReload
                });
            });

            var t = new Table;

            data.forEach(function(product) {
                t.cell('Name', product.name);
                t.cell('Service', product.serviceName);
                t.cell('Type', product.type);
                t.cell('Reload?', product.doesReload);
                t.newRow();
            });

            callback(null, t.toString());
        });
    }
};

// We break our different modules into different files, then we extend the
// prototype of the client based on the merged functions

var prototype = _.extend({},
    core
);

_.each(prototype, function(value, key) {
    REPL.prototype[key] = value;
});

