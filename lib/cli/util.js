var Bender = require('../bender'),
    colors = require('colors'),
    _ = require('underscore'),
    async = require('async');

exports.Util = {
    resetDatabase: function() {
        var self = this;

        Bender.createClient(_.extend({
            reset: true
        }, self.config), function(err, bender) {
            if (err || !bender) {
                console.error('Unable to reset bender'.bold.red, err);
                process.exit(1);
            }

            console.log('Successfully reset Bender'.green);
            process.exit(0);
        });
    },

    installBender: function(serverId) {
        var self = this;

        if (typeof(serverId) === 'boolean') {
            console.log('Loading Servers...'.cyan);
            self.bender.getServers(function(err, servers) {

                if (!servers.length) {
                    console.log('\n  No Servers Found'.red);
                    process.exit(1);
                    return;
                }

                self.app.choose(_.map(servers, function(server) {
                    return server.name.bold.yellow + ' ('.data + server.environment.name.cyan + ')'.data;
                }), function(i) {
                    self.bender.installBender(servers[i], '/usr/lib/node_modules/bender/lib/config.json', function(err) {
                        if (err) {
                            console.log('Unable to install bender on server!'.red);
                            process.exit(1);
                        }
                        else {
                            console.log('Successfully installed bender on server ' + servers[i].name.green);
                            process.exit(0);
                        }
                    });
                });
            });
        }
        else {
            self.bender.installBender(serverId, '/usr/lib/node_modules/bender/lib/config.json', function(err) {
                process.exit(err ? 1 : 0);
            });
        }
    },

    updateBenderOnServers: function(configPath) {
        var self = this;

        self.bender.getEnvironments(function(err, envs) {

            var options = _.map(envs, function(env) {
                return env.name.yellow;
            });

            options.unshift('All Environments'.red);

            console.log('\n  Please choose an environment:'.bold.yellow);
            console.log('   This command will update bender all of the servers in the'.data);
            console.log('   selected environment.\n'.data);

            self.app.choose(options, function(i) {
                // All environments?
                if (i === 0) {
                    console.log('Updating All Servers...'.cyan);
                    self.bender.updateBender(configPath, updateCallback);
                }
                else {
                    console.log('Updating All Servers In '.cyan + envs[i - 1].name.red + '...'.cyan);
                    self.bender.updateBender(configPath, envs[i - 1].id, updateCallback);
                }
            });
        });

        function updateCallback(err) {
            if (err) {
                self.log.error('Unable to update bender on servers'.red);
                process.exit(1);
            }
            else {
                console.log('Successfully updated servers'.green);
                process.exit(0);
            }
        }
    },

    updateEnvironment: function() {
        var self = this;

        self.bender.getEnvironments(function(err, envs) {

            console.log('\n  Please choose an environment:'.bold.yellow);
            console.log('   This command will run puppet on all of the servers in the'.data);
            console.log('   selected environment.\n'.data);
            self.app.choose(_.map(envs, function(env) {
                return env.name.yellow;
            }), function(i) {
                self.bender.updateEnvironment(envs[i].id, function(err) {
                    process.exit(err ? 1 : 0);
                });
            });
        });
    },

    whitelistServers: function() {
        var self = this;

        console.log('Whitelisting Servers...'.cyan);

        self.bender.updateServerWhitelists(function(err) {
            if (err) {
                self.log.error('Unable to update whitelist'.red);
                process.exit(1);
            }
            else {
                console.log('Successfully whitelisted servers'.green);
                process.exit(0);
            }
        });
    },

    getServerAddress: function(serverName, environmentName) {
        var self = this;

        self.bender.getEnvironments(function(err, envs) {
            if (err) {
                process.exit(1);
                return;
            }

            var server, environment;

            _.each(envs, function(env) {
                if (env.name.toLowerCase() === environmentName.toLowerCase()) {
                    environment = env;
                }
            });

            if (!environment) {
                process.exit(1);
                return;
            }

            self.bender.getServersForEnvironment(environment.id, function(err, servers) {
                if (err) {
                    process.exit(1);
                    return;
                }

                _.each(servers, function(srv) {
                    if (srv.name.toLowerCase() === serverName.toLowerCase()) {
                        server = srv;
                    }
                });

                if (server) {
                    console.log(server.getPrivateIp());
                }
            });
        });
    }
};
