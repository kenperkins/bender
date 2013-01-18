var async = require('async'),
    _ = require('underscore');

    exports.Destroy = {
        destroyServer: function(callback) {
        var self = this;
        console.log('Loading Servers...'.cyan);
        self.bender.getServers(function(err, servers) {

            if (!servers.length) {
                console.log('\n  No Servers Found'.red);
                callback && callback();
                return;
            }

            async.forEach(servers, function(server, next) {
                server.getEnvironment().done(function(err, env) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    server.environment = env;
                    next();
                });
            }, function(err) {
                self.app.choose(_.map(servers, function(server) {
                    return server.name.bold.yellow + ' ('.data + server.environment.name.cyan + ')'.data;
                }), function(i) {
                    self.bender.destroyServer(servers[i].id, function(err) {
                        if (err) {
                            console.log('Unable to delete server!'.red);
                            process.exit(1);
                        }
                        else {
                            console.log('Sucessfully deleted server ' + servers[i].name.green);
                            process.exit(0);
                        }
                    });
                })
            });
        });
    },

    clearServices: function() {
        var self = this,
            choices = {};

        async.series([
            function(callback) {
                self.bender.getEnvironments(function(err, envs) {
                    console.log('\n  Please choose an environment:'.bold.yellow);
                    self.app.choose(_.map(envs, function(env) {
                        return env.name.yellow;
                    }), function(i) {
                        choices.environment = envs[i];
                        callback();
                    });
                });
            },
            function(callback) {
                if (!choices.environment) {
                    callback({ error: 'Environment not found' });
                    return;
                }

                self.bender.getServersForEnvironment(choices.environment.id, function(err, servers) {
                    console.log('\n  Please choose a server:'.bold.yellow);
                    self.app.choose(_.map(servers, function(servers) {
                        return servers.name.yellow;
                    }), function(i) {
                        choices.server = servers[i];
                        callback();
                    });
                });
            },
            function(callback) {
                if (!choices.server) {
                    callback({ error: 'server not found' });
                    return;
                }

                choices.server.getServices().done(function(err, services) {
                    choices.server.services = services;
                    callback();
                });
            },
            function(callback) {

                self.bender.getServices(function(err, services) {
                    choices.services = choices.server.services;

                    console.log('Current Services for ' + choices.server.getFriendlyLabel().green);

                    console.log('\nAre you sure you want to remove the mapping for these services?'.bold.red);

                    self.app.choose(['Yes', 'No'], function(i) {
                        if (i === 1) {
                            callback({ error: 'Declined confirmation '});
                        }
                        else {
                            callback();
                        }
                    });
                });
            }],
            function(err) {

                if (err) {
                    console.dir(error);
                    process.exit(1);
                    return;
                }

                choices.server.setServices([]).done(function(err) {
                    process.exit(err ? 1 : 0);
                });
            });
    }
};