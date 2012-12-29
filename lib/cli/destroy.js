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
    }
};