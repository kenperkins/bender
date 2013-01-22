var async = require('async'),
    Table = require('easy-table'),
    _ = require('underscore');

exports.List = {
    listEnvironments: function(callback) {
        var self = this;
        console.log('Loading Environments...'.cyan);
        self.bender.getEnvironments(function(err, environments) {

            if (!environments.length) {
                console.log('\n  No Environments Found'.red);
                callback && callback();
                return;
            }

            async.forEach(environments, function(environment, next) {
                var privDomain, pubDomain;

                async.parallel([
                    function(parallelCallback) {
                        environment
                            .getPrivateDomain()
                            .done(function(err, domain) {
                                if (err) {
                                    parallelCallback(err);
                                    return;
                                }

                                privDomain = domain;
                                parallelCallback();
                            });
                    },
                    function(parallelCallback) {
                        environment
                            .getPublicDomain()
                            .done(function(err, domain) {
                                if (err) {
                                    parallelCallback(err);
                                    return;
                                }

                                pubDomain = domain;
                                parallelCallback();
                            });
                    }
                ], function(err) {
                    if (err) {
                        console.log('  ('.data + environment.id.toString().cyan + ') '.data + environment.name.info);
                        console.log(('  Unable to load domains for ' + environment.name).red);
                        next();
                    }
                    else {
                        console.log('  ('.data + environment.id.toString().cyan + ') '.data +
                            environment.name.info + '\tPrivate DNS: '.data + privDomain.name.green +
                            '\tPublic DNS: '.data + pubDomain.name.green);
                        next();
                    }
                });
            }, function(err) {
                callback && callback();
            });
        });
    },

    listServers: function(callback) {
        var self = this;
        console.log('Loading Servers...\n'.cyan);
        self.bender.getServers(function(err, servers) {

            if (!servers.length) {
                console.log('\n  No Servers Found'.red);
                callback && callback();
                return;
            }

            _.each(servers, function(server) {
                var output = '';
                if (!server.environment) {
                    output += '  ('.data + server.id.toString().cyan + ') '.data + server.name.info + '\n';
                    output += ('\n  Unable to load environment for ' + server.name).red;
                }
                else {
                    output += '  ('.data + server.id.toString().cyan + ') '.data +
                        server.name.info + '\tEnvironment: '.data + server.environment.name.green + '\n';
                }

                _.each(server.addresses, function(address) {
                    output += '\t' + (address.isPublic ? 'Public IP: ' : 'Private IP: ').data +
                        address.ipAddress.green;
                });

                output += '\n';

                console.log(output);
            });
        });
    },

    listProviders: function(callback) {
        var self = this;
        console.log('Loading Providers...'.cyan);
        self.bender.getProviders(function(err, providers) {

            if (!providers.length) {
                console.log('\n  No Providers Found'.red);
                callback && callback();
                return;
            }

            _.each(providers, function(provider) {
                console.log('  ('.data + provider.id.toString().cyan + ') '.data +
                    provider.name.info);
            });


            callback && callback(err, providers);

        });
    },

    listServices: function(callback) {
        var self = this;
        console.log('Loading Services...'.cyan);
        self.bender.getServices(function(err, services) {

            if (!services.length) {
                console.log('\n  No Services Found'.red);
                callback && callback();
                return;
            }

            var data = [];

            _.each(services, function(service) {
                data.push({
                    id: service.id,
                    name: service.name,
                    type: service.type,
                    reload: service.doesReload,
                    serviceName: service.serviceName
                });
            });

            var t = new Table;

            data = _.sortBy(data, function(value) {
                return value.name;
            });

            data.forEach(function(status) {
                t.cell('Id', status.id);
                t.cell('Name', status.name);
                t.cell('Type', status.type);
                t.cell('Reload?', status.reload ? 'Yes' : 'No');
                t.cell('Service', status.serviceName);
                t.newRow();
            });

            console.log(t.toString());

            callback && callback(err, services);

        });
    }
};