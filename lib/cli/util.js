var Bender = require('../bender'),
    colors = require('colors'),
    _ = require('underscore'),
    iptables = require('iptables');

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
        self.bender.installBender(serverId, function(err) {
            process.exit(err ? 1 : 0);
        });
    }
};
