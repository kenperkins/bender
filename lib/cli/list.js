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

            var data = [];

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

                    var obj = {
                        id: environment.id,
                        name: environment.name
                    };

                    if (err) {
                        data.push(obj);
                        next();
                    }
                    else {
                        obj.privateDns = privDomain.name;
                        obj.publicDns = pubDomain.name;
                        data.push(obj);
                        next();
                    }
                });
            }, function(err) {

                var t = new Table;

                data = _.sortBy(data, function(value) {
                    return value.name;
                });

                data.forEach(function(env) {
                    t.cell('Id', env.id);
                    t.cell('Name', env.name);
                    t.cell('Public Dns', env.publicDns);
                    t.cell('Private Dns', env.privateDns);
                    t.newRow();
                });

                console.log(t.toString());

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

            var data = [];

            _.each(servers, function(server) {
                var obj = {
                    id: server.id,
                    name: server.name
                };

                if (server.environment) {
                    obj.environment = server.environment.name;
                }

                _.each(server.addresses, function(address) {
                    if (address.isPublic && address.type == '4') {
                        obj.publicAddress = address.ipAddress;
                    }
                    else if (address.isPrivate && address.type == '4') {
                        obj.privateAddress = address.ipAddress;
                    }
                });

                obj.providerRecordId = server.providerRecordId;

                data.push(obj);
            });

            var t = new Table;

            data = _.sortBy(data, function(value) {
                return value.environment + ' ' + value.name;
            });

            data.forEach(function(server) {
                t.cell('Id', server.id);
                t.cell('Env', server.environment);
                t.cell('Name', server.name);
                t.cell('Public Ip', server.publicAddress);
                t.cell('Private Ip', server.privateAddress);
                t.cell('Provider Id', server.providerRecordId);
                t.newRow();
            });

            console.log(t.toString());
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