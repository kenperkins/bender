var Bender = require('../bender'),
    colors = require('colors'),
    _ = require('underscore'),
    iptables = require('iptables'),
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

    updateServers: function(configPath) {
        var self = this;

        console.log('Updating Servers...'.cyan);
        self.bender.updateBender(configPath, function(err) {
            if (err) {
                self.log.error('Unable to update bender on servers'.red);
                process.exit(1);
            }
            else {
                console.log('Successfully updated servers'.green);
                process.exit(0);
            }
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
    }
};
