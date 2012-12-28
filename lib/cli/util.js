var Bender = require('../bender'),
    colors = require('colors'),
    _ = require('underscore');

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

    whiteListServers: function(interface, privateOnly) {
        var self = this;

        // default to private only for safety
        if (typeof(privateOnly) !== 'boolean') {
            privateOnly = true;
        }

        console.log(('Whitelisting Servers... (Private Only: ' + privateOnly + ')\n').cyan);

        // target rule
        // iptables -A INPUT -i eth1 -s $ip -d 0.0.0.0/0 -j ACCEPT

        self.bender.getServers(function(err, servers) {
            _.each(servers, function(server) {
                console.log('  Processing Server: '.data + server.name.green + (' [' + server.environment.name + ']').data);
                _.each(server.addresses, function(address) {
                    if (privateOnly && !address.isPublic) {
                        whitelist();
                    }
                    else if (!privateOnly) {
                        whitelist();
                    }

                    function whitelist() {
                        try {
                            iptables.allow({
                                src: address.ipAddress,
                                dst: '0.0.0.0/0',
                                in: interface
                            });
                            console.log('    Whitelisting: '.data + address.ipAddress.green);
                        }
                        catch (e) {
                            console.log('    Skipping: '.data + address.ipAddress.green);
                        }
                    }
                });
            });
        });
    }
};
