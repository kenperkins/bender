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

    updateBenderOnServers: function() {
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
                console.log('\nAre you sure you want to update Bender on '.bold.red + options[i].bold.yellow + '?'.bold.red);

                self.app.choose(['Yes', 'No'], function(j) {
                    if (j === 1) {
                        console.log('Declined Confirmation'.bold.red);
                        process.exit(1);
                    }
                    else {
                        // All environments?
                        if (i === 0) {
                            console.log('Updating All Servers...'.cyan);
                            self.bender.updateBender(updateCallback);
                        }
                        else {
                            console.log('Updating All Servers In '.cyan + envs[i - 1].name.red + '...'.cyan);
                            self.bender.updateBender(envs[i - 1].id, updateCallback);
                        }
                    }
                });
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

    runPuppetOnServers: function() {
        var self = this;

        console.log('\n This command will run puppet on a set of servers.\n'.bold.yellow);

        self.bender.getEnvironments(function(err, envs) {
            console.log('\n  Please select an environment:'.bold.yellow);
            self.app.choose(_.map(envs, function(env) {
                return env.name.yellow;
            }), function(i) {

                console.log('\n  Do you want to run puppet:'.bold.yellow);
                self.bender.getServersForEnvironment(envs[i].id, function(err, servers) {
                    self.app.choose(['By Service', 'By Server'], function(j) {
                        if (j === 0) {
                            self.bender.getServices(function(err, services) {
                                var options = _.map(services, function(service) {
                                    return service.name.yellow;
                                });

                                options.unshift('All Servers'.red);

                                console.log('\n  Please Choose a Service:'.bold.yellow);
                                self.app.choose(options, function(k) {
                                    if (k === 0) {
                                        confirm('\nAre you sure you want to run puppet on '.bold.red +
                                            envs[i].name.bold.yellow + '?'.bold.red, servers);
                                    }
                                    else {

                                        var servicesMap = [];

                                        async.forEach(servers, function(server, next) {
                                            server.getServices().done(function(err, svcs) {
                                                if (err) {
                                                    next(err);
                                                    return;
                                                }

                                                _.each(svcs, function(svc) {
                                                    if (svc.id === services[k - 1].id) {
                                                        servicesMap.push(server);
                                                    }
                                                });

                                                next();
                                            });
                                        }, function(err) {
                                            confirm('\nAre you sure you want to run puppet on '.bold.red +
                                                services[k - 1].name.bold.yellow + '?'.bold.red, servicesMap);
                                        });
                                    }
                                });
                            });
                        }
                        else {
                            console.log('\n  Please Choose a Server:'.bold.yellow);
                            self.app.choose(_.map(servers, function(server) {
                                return server.getFriendlyLabel()
                            }), function(l) {
                                confirm('\nAre you sure you want to run puppet on '.bold.red +
                                    servers[l].getFriendlyLabel().bold.yellow + '?'.bold.red, [servers[l]]);
                            });
                        }
                    });
                });
            });
        });

        function confirm(message, servers) {
            console.log(message);
            console.log();

            self.app.choose(['Yes', 'No'], function(j) {
                if (j === 1) {
                    console.log('Declined Confirmation'.bold.red);
                    process.exit(1);
                }
                else {
                    self.bender.runPuppetOnServers(servers, function(err) {
                        process.exit(err ? 1 : 0);
                    });
                }
            });
        }
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
