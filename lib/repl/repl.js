var async = require('async'),
    Bender = require('../bender'),
    colors = require('colors'),
    exec = require('child_process').exec,
    ping = require('ping'),
    repl = require('repl'),
    Rsync = require('rsync'),
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
                callback(null, new Date().toUTCString() +
                    '\n\nEnter '.data + 'help'.bold.yellow + ' for a list of commands'.data);
                break;
            case 'env':
                if (commands.length === 1) {
                    self.displayEnvironments(callback);
                }
                else if (commands.length === 2) {
                    self.setEnvironmentByName(commands[1], callback);
                }
                break;

                if (commands.length === 1) {
                    self.serviceCommand('status', callback);
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
            case 'status':
            case 'stop':
            case 'start':
            case 'restart':
                if (commands.length === 2) {
                    self.serviceCommand(commands[0], commands[1], callback);
                }
                else if (commands.length === 1 && commands[0] === 'status') {
                    self.serviceCommand(commands[0], callback);
                }
                else {
                    process.nextTick(callback);
                }
                break;
            case 'site':
                if (commands.length === 2) {
                    self.updateSiteStatus(commands[1], callback);
                }
                else {
                    process.nextTick(callback);
                }
                break;
            case 'deploy':
                self.deploy(callback);
                break;
            case 'help':
            case '?':
                self.help(commands, callback);
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

    help: function(commands, callback) {
        if (commands.length === 1) {
            var output = '\nBender REPL'.bold.yellow;
            output += '\n  The server/service management app from Clipboard\n\n'.data;
            output += 'The following commands are available when using Bender REPL:\n\n';

            var data = [];

            data.push({
                command: 'help | ?',
                text: 'Lists the available commands for Bender REPL.'
            });

            data.push({
                command: 'env',
                text: 'Lists the available environments for Bender.'
            });

            data.push({
                command: 'env <name>',
                text: 'Update the current environment to the specified environment.'
            });

            data.push({
                command: 'list',
                text: 'Lists the servers in the current environment.'
            });

            data.push({
                command: 'ping',
                text: 'Ping all of the servers in the current environment.'
            });

            data.push({
                command: 'services',
                text: 'List the services available for Bender.'
            });

            data.push({
                command: 'status',
                text: 'Do a status check of all services running on all servers in the current environment.'
            });

            data.push({
                command: 'status <serviceName>',
                text: 'Get status for all instances of a service for the current environment.'
            });

            data.push({
                command: 'start <serviceName>',
                text: 'Start all instances of a service for the current environment.'
            });

            data.push({
                command: 'restart <serviceName>',
                text: 'Restart all instances of a service for the current environment.'
            });

            data.push({
                command: 'stop <serviceName>',
                text: 'Stop all instances of a service for the current environment.'
            });

            data.push({
                command: 'site [up|down]',
                text: 'Put or remove the website from maintenance mode.'
            });

            data.push({
                command: 'deploy',
                text: 'Deploys the current version of the website and restarts services.'
            });

            var t = new Table;

            data.forEach(function(command) {
                t.cell('Command', command.command);
                t.cell('Description', command.text);
                t.newRow();
            });

            output += t.toString();

            callback(null, output);

        }
        else if (commands.length === 2) {
            callback();
        }
    },

    updateSiteStatus: function(status, callback) {
        var self = this,
            lbs = [];

        console.log('\nUpdating Site Status for Environment: ' + self.currentEnvironment.name.bold.green + '\n');

        // Now determine the non-frontline servers to deploy
        self.bender.getServersForEnvironment(self.currentEnvironment.id, function(err, servers) {
            if (err) {
                callback(err, 'Unable to get servers');
                return;
            }

            async.forEachSeries(servers, function(server, next) {
                server.getServices().done(function(err, services) {
                    if (err) {
                        next(err);
                        return;
                    }

                    server.services = services;

                    _.each(services, function(service) {
                        if (service.name === 'Clipboard-Nginx') {
                            lbs.push({
                                server: server,
                                service: service
                            });
                        }
                    });

                    next();
                });
            }, function(err) {
                if (err) {
                    callback(err, 'Unable to find load balancers');
                    return;
                }

                async.forEach(lbs, function(lb, next) {
                    console.log('\nUpdating ' + lb.server.name.bold.green + '\n');
                    if (status === 'up') {
                        self.bender.execServerCommand(lb.server, 'siteUp', handleResponse);
                    }
                    else if (status === 'down') {
                        self.bender.execServerCommand(lb.server, 'siteDown', handleResponse);
                    }

                    function handleResponse(err) {
                        self.bender.execServiceCommand(lb.server, lb.service,
                            'restart', next);
                    }
                }, function(err) {
                    if (err) {
                        console.log('\nUnable to update site status\nPlease check website immediately!\n'.bold.red);
                    }
                    else {
                        console.log('\nUpdated site status.'.green);
                    }
                    callback(err);
                });
            });
        });
    },

    deploy: function(callback) {
        var self = this,
            options = {
                cwd: self.config.deploy.gitPath.replace('%%ENV%%', self.currentEnvironment.name)
            };

        var workers = [], appServers = [], others = [];

        console.log('\nStarting Deployment for Environment: ' + self.currentEnvironment.name.bold.green + '\n');

        // first, make sure we've got the latest code for the current environment
        exec('git status', options, function(err) {
            if (err) {
                callback(err, 'Unable to check branch status');
                return;
            }

            exec('git checkout ' + self.currentEnvironment.name, options, function(err) {
                if (err) {
                    callback(err, 'Unable to check out branch');
                    return;
                }

                exec('git pull', options, function(err) {
                    if (err) {
                        callback(err, 'Unable to pull');
                        return;
                    }

                    // Now determine the non-frontline servers to deploy
                    self.bender.getServersForEnvironment(self.currentEnvironment.id, function(err, servers) {
                        if (err) {
                            callback(err, 'Unable to get servers');
                            return;
                        }

                        async.forEachSeries(servers, function(server, next) {
                            server.getServices().done(function(err, services) {
                                if (err) {
                                    next(err);
                                    return;
                                }

                                server.services = services;

                                _.each(services, function(service) {
                                    if (service.name === 'Clipboard-App') {
                                        appServers.push({
                                            server: server,
                                            service: service
                                        });
                                    }
                                    else if (service.name === 'Clipboard-Worker') {
                                        workers.push({
                                            server: server,
                                            service: service
                                        });
                                    }
                                    else if (service.name === 'Clipboard-Admin' ||
                                        service.name === 'Clipboard-Blog') {
                                        others.push({
                                            server: server,
                                            service: service
                                        });
                                    }
                                });

                                next();
                            });
                        }, function(err) {

                            async.series([
                                function(asyncCallback) {
                                    // first stop the workers
                                    async.forEach(workers, function(worker, next) {
                                        console.log('Stopping ' +
                                            worker.service.name.green + ' on ' +
                                            worker.server.name.yellow);
                                        self.bender.execServiceCommand(worker.server.id,
                                            worker.service,
                                            'stop', function(err, code) {
                                                console.log('Service Stopped on ' +
                                                    worker.server.name.yellow);
                                                next();
                                            });
                                    }, asyncCallback);
                                },
                                function(asyncCallback) {
                                    // deploy the bits to the app servers
                                    async.forEach(appServers, deployServer, asyncCallback);
                                },
                                function(asyncCallback) {
                                    async.forEach(appServers, function(appServer, next) {
                                        console.log('Restarting ' + appServer.service.name + ' on ' + appServer.server.name);
                                        self.bender.execServiceCommand(appServer.server.id,
                                            appServer.service,
                                            'restart', next);
                                    }, asyncCallback);
                                },
                                function(asyncCallback) {
                                    // deploy the bits to the workers servers
                                    async.forEach(workers, deployServer, asyncCallback);
                                },
                                function(asyncCallback) {
                                    // deploy the bits to the other servers
                                    async.forEach(others, deployServer, asyncCallback);
                                },
                                function(asyncCallback) {
                                    async.forEach(workers, function(worker, next) {
                                        console.log('Starting ' + worker.service.name + ' on ' + worker.server.name);
                                        self.bender.execServiceCommand(worker.server.id,
                                            worker.service,
                                            'start', next);
                                    }, asyncCallback);
                                },
                                function(asyncCallback) {
                                    async.forEach(others, function(other, next) {
                                        console.log('Restarting ' + other.service.name + ' on ' + other.server.name);
                                        self.bender.execServiceCommand(other.server.id,
                                            other.service,
                                            'restart', next);
                                    }, asyncCallback);
                                }
                            ], function(err) {
                                callback(err, 'Finished Deploy');
                            });
                        });
                    });
                });
            });
        });

        function deployServer(target, callback) {

            var srcPath = self.config.deploy.gitPath.replace('%%ENV%%', self.currentEnvironment.name) +
                    self.config.deploy.sourcePath,
                destPath = self.config.deploy.destinationPath;

            console.log('Deploying to ' + target.service.name.green +
                ' ' + target.server.name.yellow);
            // Build the command
            var rsync = new Rsync()
                .shell('ssh')
                .flags('Cav')
                .source(srcPath)
                .destination(target.server.getPrivateIp() + ':' + destPath);

            rsync.set('delete-after');

            // Execute the command
            rsync.execute(function(err, stdout, stderr) {
                if (err) {
                    console.log('Failed to deploy to ' +
                        target.service.name +
                        ' ' + target.server.name);
                    callback(err);
                }
                else {
                    console.log('Deployed to ' +
                        target.service.name +
                        ' ' + target.server.name);
                    callback(err);
                }
            });
        }
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

                data = _.sortBy(data, function(server) {
                    return server.name;
                });
                
                data.forEach(function(server) {
                    t.cell('Name', server.name);
                    t.cell('Status', server.status);
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

            data = _.sortBy(data, function(service) {
                return service.name;
            });

            data.forEach(function(service) {
                t.cell('Name', service.name);
                t.cell('Process', service.serviceName);
                t.cell('Type', service.type);
                t.cell('Reload?', service.doesReload);
                t.newRow();
            });

            callback(null, t.toString());
        });
    },

    serviceCommand: function(command, service, callback) {

        if (typeof(service) === 'function') {
            callback = service;
            service = null;
        }

        var self = this;
        self.bender.getServersForEnvironment(self.currentEnvironment.id, function(err, servers) {
            if (err) {
                self.log.error('Unable to load servers', err);
                callback(err);
                return;
            }

            var services = [], data = [];

            async.forEachLimit(servers, 10, function(server, next) {
                self.log.verbose('Processing Server ' + server.name);
                server.getServices().done(function(err, svcs) {
                    if (err) {
                        next(err);
                        return;
                    }

                    _.each(svcs, function(svc) {
                        if (!service || (service.toLowerCase() === svc.name.toLowerCase())) {
                            services.push({
                                server: server,
                                service: svc
                            });
                        }
                    });

                    next();
                });
            }, function(err) {
                async.forEachLimit(services, 10, function(service, next) {
                    self.log.verbose('Processing Status for ' + service.service.name + ' on ' + service.server.name);
                    self.bender.execServiceCommand(service.server, service.service, command, function(err, code) {
                        if (code === parseInt(2)) {
                            data.push({
                                server: service.server.name,
                                service: service.service.name,
                                status: 'error'
                            });
                        }
                        else if (err || code === parseInt(1)) {
                            data.push({
                                server: service.server.name,
                                service: service.service.name,
                                status: 'down'
                            });
                        }
                        else {
                            data.push({
                                server: service.server.name,
                                service: service.service.name,
                                status: 'OK'
                            });
                        }

                        next();
                    });
                }, function(err) {
                    self.log.verbose('displaying status');
                    var t = new Table;

                    data = _.sortBy(data, function(value) {
                        return value.server;
                    });

                    data.forEach(function(status) {
                        t.cell('Name', status.server);
                        t.cell('Service', status.service);
                        t.cell('Status', status.status);
                        t.newRow();
                    });

                    callback(null, t.toString());
                });
            });
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

