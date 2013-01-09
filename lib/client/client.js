/*
 * client.js: Core functions for bender
 *
 * (C) 2012 Clipboard, Inc.
 *
 * MIT LICENSE
 *
 */

var async = require('async'),
    rackspace = require('rackspace-openstack'),
    Sequelize = require('sequelize'),
    models = require('./models'),
    _ = require('underscore'),
    iptables = require('iptables'),
    Connection = require('ssh2'),
    scp = require('scp'),
    winston = require('winston');

exports.createClient = function(options, callback) {
    var client = new Client(options);

    client.initialize(options, callback);
};

var Client = exports.Client = function(options) {

    if (!options) {
        throw new Error('options is required to create a client');
    }

    ['database', 'rackspace', 'bootstrap'].forEach(function(required) {
        if (!options[required]) throw new Error('options.' +
            required + ' is a required argument.');
    });

    this.config = {};

    this.config.database = options.database;
    this.config.rackspace = options.rackspace;
    this.config.logLevel = options.logLevel || 'warn';
    this.config.providerId = options.providerId;
    this.config.bootstrap = options.bootstrap;
};

var core = {
    initialize: function(options, callback) {

        var self = this;

        if (self.initialized) {
            callback(null, self);
            return;
        }

        self._configureLogging(options.fileLog);

        self.log.info('Initializing Bender...');

        // setup the rackspace bindings
        self.rackspace = rackspace.createClient({
            auth: {
                username: self.config.rackspace.username,
                apiKey: self.config.rackspace.apiKey
            },
            log: self.log
        });

        // setup the sequelize bindings
        self.db = new Sequelize(self.config.database.database,
            self.config.database.username, self.config.database.password, {
                host: self.config.database.host,
                logging: self.log.debug
            });

        // auth to rackspace and sync the db models in parallel
        async.parallel([ function(asyncCallback) {
            models.sync(self, options, function(err) {
                if (err) {
                    self.log.error('Unable to sync models to database', err);
                    asyncCallback(err);
                    return;
                }

                self.log.info('Database Models Synchronized');
                asyncCallback(err);
            });
        }, function(asyncCallback) {
            self.rackspace.authorize(function(err, config) {
                if (err) {
                    self.log.error('Unable to authorize to Rackspace', err);
                    asyncCallback(err);
                    return;
                }

                self.log.info('Rackspace API Initialized');
                asyncCallback(err);
            });
        }], function(err) {
            self.Provider.find(self.config.providerId).done(function(err, provider) {
                if (err) {
                    self.log.error('Unable to load provider', err);
                    callback(err);
                    return;
                }

                if (provider) {
                    self.log.info('Provider ' + provider.name.green + ' Initialized');
                }

                self.provider = provider;
                self.initialized = true;
                callback(err, self);
            });
        });
    },

    createEnvironment: function(details, callback) {
        var self = this;

        ['name', 'privateDomain', 'publicDomain'].forEach(function(required) {
            if (!details[required]) throw new Error('details.' +
                required + ' is a required argument.');
        });

        var env = self.Environment.build({
            name: details.name
        });

        env
            .save()
            .done(function(err, result) {
                if (err) {
                    self.log.error('Unable to create environment', err);
                    callback(err);
                    return;
                }

                async.parallel([
                    function(asyncCallback) {
                        env
                            .setPublicDomain(details.publicDomain)
                            .done(function(err, result) {
                                asyncCallback(err);
                            });
                    },
                    function(asyncCallback) {
                        env
                            .setPrivateDomain(details.privateDomain)
                            .done(function(err, result) {
                                asyncCallback(err);
                            });
                    }
                ], function(err) {
                    if (err) {
                        self.log.error('Unable to associate domains', err);
                        callback(err);
                        return;
                    }

                    callback(err, env);
                });
            });
    },

    getEnvironments: function(callback) {
        var self = this;

        self.Environment
            .findAll()
            .done(function(err, environments) {
                if (err) {
                    self.log.error('Unable to get environments', err);
                    callback(err);
                    return;
                }

                callback(null, environments);
            });
    },

    getProviders: function(callback) {
        var self = this;

        self.Provider
            .findAll()
            .done(function(err, providers) {
                if (err) {
                    self.log.error('Unable to get providers', err);
                    callback(err);
                    return;
                }

                callback(null, providers);
            });
    },

    createProvider: function(name, callback) {
        var self = this;

        if (!name) {
            throw new Error('Name is required');
        }

        var provider = self.Provider.build({ name: name });

        provider
            .save()
            .done(function(err, result) {
                if (err) {
                    self.log.error('Unable to create provider', err);
                    callback(err);
                    return;
                }

                callback(err, provider);
            });
    },

    getServer: function(serverId, callback) {
        var self = this;

        self.Server
            .find({
                where: {
                    id: serverId
                },
                include: ['environment', 'Addresses' ]
            })
            .done(function(err, server) {
                if (err) {
                    self.log.error('Unable to get server', err);
                    callback(err);
                    return;
                }

                callback(null, server);
            });
    },

    getServers: function(callback) {
        var self = this;

        self.Server
            .findAll({ include: ['environment', 'Addresses' ]})
            .done(function(err, servers) {
                if (err) {
                    self.log.error('Unable to get servers', err);
                    callback(err);
                    return;
                }

                callback(null, servers);
            });
    },

    createServer: function(details, callback) {
        var self = this;

        ['name', 'environment', 'image', 'flavor'].forEach(function(required) {
            if (!details[required]) throw new Error('details.' +
                required + ' is a required argument.');
        });

        self.rackspace.createServerWithWait({
            name: details.name,
            image: details.image,
            flavor: details.flavor
        }, {
            maxWait: 600,
            update: function() {
                process.stdout.write('.');
            },
            finish: function() {
                process.stdout.write('\n');
            }
        }, function(err, server) {

            self.log.debug('Return value from Rackspace.createServer', server);
            self.log.verbose('Rackspace server created', server.id);

            if (err && !server) {
                self.log.error('Couldn\'t create server at rackspace', err);
                callback(err);
                return;
            }
            else if (err && server) {
                self.log.error('Timeout trying to wait for server to online');
            }


            var dbServer = self.Server.build({
                name: server.name,
                status: server.status,
                providerId: self.provider.id,
                environmentId: details.environment.id,
                providerRecordId: server.id,
                providerHostId: server.hostId,
                providerImageId: server.image.id,
                providerFlavorId: server.flavor.id
            });

            var addresses = [];

            dbServer.save().done(function(err, result) {
                if (err) {
                    self.log.error('Unable to save Server', err);
                    callback(err);
                    return;
                }

                if (server.status !== 'ACTIVE') {
                    callback(null, {
                        server: dbServer,
                        adminPassword: server.adminPass,
                        addresses: addresses
                    });
                    return;
                }

                self.log.verbose('Local Server created, creating ip address records');
                async.parallel([
                    saveIpAddress(addresses, dbServer, server.addresses.public, true),
                    saveIpAddress(addresses, dbServer, server.addresses.private, false)],
                    function(err) {

                        dbServer.addresses = addresses;

                        self.log.verbose('Ip addresses created');

                        if (err) {
                            self.log.error('Unable to add server ipAddresses', err);
                            callback(err);
                            return;
                        }

                        self.installBender(dbServer, '/usr/lib/node_modules/bender/lib/config.json', function(err) {

                            if (err) {
                                self.log.error('Unable to install bender', err);
                            }

                            self.authenticateServerOnPuppet(dbServer.id, function(err) {
                                callback(err, {
                                    server: dbServer,
                                    adminPassword: server.adminPass,
                                    addresses: addresses
                                });
                            });
                        });
                    });
            });
        });

        function saveIpAddress(addresses, server, ipAddressSet, isPublic) {
            return function(asyncParallel) {
                async.forEach(ipAddressSet,
                    function(address, next) {
                        var addr = self.IpAddress.build({
                            ipAddress: address.addr,
                            isPublic: isPublic,
                            type: address.version,
                            serverId: server.id
                        });

                        self.log.verbose('processing address in set isPublic: ' + isPublic);

                        addr.save().done(function(err, result) {

                            self.log.debug('address callback');
                            if (err) {
                                self.log.error('Unable to create ipAddress', {
                                    error: err,
                                    address: address
                                });
                                next(err);
                                return;
                            }

                            if (addr.type === 6) {
                                addresses.push(addr);
                                next();
                                return;
                            }

                            // create dns record if ipv4
                            self.createDnsRecordForIpAddress(server, addr,
                               details.environment, function(err, record) {

                                    self.log.verbose('created dns records');

                                    if (err) {
                                        self.log.error('Couldn\'t create dns record for  address', err);
                                        next(err);
                                        return;
                                    }

                                    addr.dnsRecords = [ record ];
                                    addresses.push(addr);
                                    next()
                                });
                        });
                    },
                    function(err) {
                        if (err) {
                            self.log.error('Couldn\'t import addresses', err);
                        }
                        asyncParallel(err);
                    });
            }
        }
    },

    createDnsRecordForIpAddress: function(server, ipAddress, environment, callback) {

        var self = this;

        self.log.verbose('Creating dns records for server');

        if (ipAddress.isPublic) {
            environment.getPublicDomain().done(domainCallback);
        }
        else {
            environment.getPrivateDomain().done(domainCallback);
        }

        function domainCallback(err, domain) {

            if (err) {
                self.log.error('Unable get domain', err);
                callback(err);
                return;
            }

            self.log.debug(require('util').inspect(ipAddress, false, null, true));

            var newRecord = {
                name: server.name + '.' +
                    (domain.name),
                type: 'A',
                data: ipAddress.ipAddress
            };

            self.rackspace.getDomain(domain.providerRecordId, function(err, providerDomain) {

                self.log.debug('getDomain: createDnsRecordForIpAddress');

                if (err || !providerDomain) {
                    self.log.error('Unable get provider domain', err);
                    callback(err);
                    return;
                }

                providerDomain.addRecordsWithWait([newRecord], function(err, records) {

                    self.log.debug('addRecordsWithWait: createDnsRecordForIpAddress');

                    if (err || !records) {
                        self.log.error('Unable to create provider dns record', err);
                        callback(err);
                        return;
                    }

                    var rsRecord = records[0];

                    var dbRecord = self.DnsRecord.build({
                        ttl: rsRecord.ttl,
                        name: rsRecord.name,
                        data: rsRecord.data,
                        type: rsRecord.type,
                        providerId: self.provider.id,
                        providerRecordId: rsRecord.id,
                        domainId: domain.id,
                        ipAddressId: ipAddress.id
                    });

                    dbRecord.save().done(function(err, result) {

                        self.log.debug('dbRecord.save: createDnsRecordForIpAddress');

                        if (err) {
                            self.log.error('Unable to save dns record', err);
                            callback(err);
                            return;
                        }

                        callback(err, dbRecord);
                    });
                });
            });
        }
    },

    destroyServer: function(serverId, callback) {
        var self = this,
            server;

        async.series([
            function(asyncSeries) {
                self.Server.find(serverId).done(function(err, result) {
                    if (err) {
                        asyncSeries(err);
                        return;
                    }

                    server = result;
                    asyncSeries();
                });
            },
            function(asyncSeries) {
                server.getAddresses().done(function(err, result) {
                    if (err) {
                        asyncSeries(err);
                        return;
                    }

                    server.addresses = result;
                    asyncSeries();
                });
            },
            function(asyncSeries) {
                server.getEnvironment().done(function(err, result) {
                    if (err) {
                        asyncSeries(err);
                        return;
                    }

                    server.environment = result;
                    asyncSeries();
                });
            }
        ], function(err) {

            if (err) {
                self.log.error('Unable to find server', err);
                callback(err);
                return;
            }

            self.removeServerFromPuppet(server, function(err) {
                async.parallel([
                    function(asyncCallback) {
                        self.removeServerFromPuppet(server, asyncCallback);
                    },
                    function(asyncCallback) {
                        server.destroy().done(asyncCallback);
                    },
                    function(asyncCallback) {
                        self.rackspace.destroyServer(server.providerRecordId, asyncCallback)
                    },
                    function(asyncCallback) {
                        async.forEach(server.addresses, function(address, next) {
                            self.removeDnsRecordsForIpAddress(address.id, function(err) {
                                if (err) {
                                    self.log.error('Unable to remove dnsRecords for ipAddress', err);
                                    next(err);
                                    return;
                                }

                                address.destroy().done(next);
                            });
                        }, asyncCallback);
                    }
                ], callback);
            });

        });
    },

    removeServerFromPuppet: function(server, callback) {
        var self = this,
            addr;

        _.each(server.addresses, function(address) {
            if (!address.isPublic) {
               addr = address;
            }
        });

        if (addr) {
            addr.getDnsRecords().done(function(err, result) {
                if (err) {
                    callback(err);
                    return;
                }

                if (result.length !== 1) {
                    self.log.error('Got more than 1 matching record for IP Address');
                    callback(err);
                    return;
                }

                self._execSshCommand({
                    host: self.config.bootstrap.puppet.master,
                    command: 'puppet cert --clean ' + result[0].name,
                    label: 'puppet master'
                }, function(err) {
                    if (err) {
                        self.log.error('Error removing server from puppet: ' + server.getFriendlyLabel(), err);
                    }

                    callback(err);
                });
            });
        }
        else {
            callback();
        }
    },

    removeDnsRecordsForIpAddress: function(ipAddressId, callback) {
        var self = this,
            ipAddress;

        async.series([
            function(asyncSeries) {
                self.IpAddress.find(ipAddressId).done(function(err, result) {
                    if (err) {
                        asyncSeries(err);
                        return;
                    }

                    ipAddress = result;
                    asyncSeries();
                });
            },
            function(asyncSeries) {
                ipAddress.getDnsRecords().done(function(err, result) {
                    if (err) {
                        asyncSeries(err);
                        return;
                    }

                    ipAddress.dnsRecords = result;
                    asyncSeries();
                });
            }
        ], function(err) {
            if (err) {
                self.log.error('Unable to find ipAddress', err);
                callback(err);
                return;
            }

            async.forEach(ipAddress.dnsRecords, function(record, next) {
                record.getDomain().done(function(err, result) {
                    if (err) {
                        self.log.error('Unable to get domain for removeDnsRecordsForIpAddress', err);
                        next(err);
                        return;
                    }

                    self.rackspace.getDomain(result.providerRecordId, function(err, providerDomain) {
                        if (err) {
                            self.log.error('Unable to get provider domain for removeDnsRecordsForIpAddress', err);
                            next(err);
                            return;
                        }

                        providerDomain.deleteRecordsWithWait([ record.providerRecordId ], function(err) {
                            if (err) {
                                self.log.err('Unable to remove records from provider', err);
                                next(err);
                                return;
                            }

                            record.destroy().done(next);
                        });
                    });
                });
            }, callback);
        });
    },

    // Import an existing rackspace domain into bender
    importDomain: function(domainId, callback) {
        var self = this;
        self.rackspace.getDomain(domainId, function(err, domain) {
            if (err) {
                self.log.error('Unable to load rackspace domain', err);
                callback(err);
                return;
            }

            var newDomain = self.Domain.build({
                name: domain.name,
                providerRecordId: domain.id,
                providerId: self.provider.id
            });

            newDomain
                .save()
                .done(function(err, result) {
                    if (err) {
                        self.log.error('Unable to save new domain', err);
                        callback(err);
                        return;
                    }

                    callback(err, newDomain);
                });
        });
    },

    execServerCommand: function(serverId, command, callback) {
        var self = this;

        if (typeof(serverId) !== 'object') {
            self.getServer(serverId, function(err, server) {

                if (err) {
                    self.log.error('Unable to load server', err);
                    callback(err);
                    return;
                }

                runCommand(server);
            });
        }
        else {
            runCommand(serverId);
        }

        function runCommand(server) {
            var cmd = 'bender --log debug --server ' + server.id + ' --command ' + command;

            self._execSshCommand({
                host: server.getPrivateIp(),
                command: cmd,
                label: server.getFriendlyLabel()
            }, callback);
        }
    },

    _execSshCommand: function(options, callback) {

        var self = this,
            connect = new Connection(),
            hasCalledBack = false;

        options.label = options.label || options.host;

        connect.on('ready', function() {
            self.log.verbose('Running SSH Command: ' + options.command);
            self.log.debug('bender-server :: connected : ' + options.label);
            self.log.debug('bender-server :: exec : ' + options.label, options.command);

            connect.exec(options.command, function(err, stream) {
                if (err) {
                    self.log.error('Unable to execute command', err);

                    if (!hasCalledBack) {
                        hasCalledBack = true;
                        callback(err);
                    }
                    return;
                }

                stream.on('data', function(data, extended) {
                    self.log.debug(extended + '\n' + data);
                });
                stream.on('end', function() {
                    self.log.debug('Stream :: EOF');
                });
                stream.on('close', function() {
                    self.log.debug('Stream :: close');
                });
                stream.on('exit', function(code, signal) {
                    self.log.debug('Stream :: exit :: code: ' + code + ', signal: ' + signal);
                    connect.end();

                    if (!hasCalledBack) {
                        hasCalledBack = true;
                        callback();
                    }
                });
            });
        });

        connect.on('error', function(err) {
            self.log.error('bender-server :: error : ' + options.label, err);

            if (!hasCalledBack) {
                hasCalledBack = true;
                callback(err);
            }
        });

        connect.on('end', function() {
            self.log.debug('bender-server :: end : ' + options.label);
        });

        connect.on('close', function(had_error) {
            self.log.debug('bender-server :: close : ' + options.label, had_error);
        });

        connect.connect({
            host: options.host,
            username: 'root',
            privateKey: require('fs').readFileSync('/root/.ssh/id_rsa')
        });
    },

    installBender: function(serverId, configFile, callback) {
        var self = this;

        if (typeof(serverId) === 'object') {
            runInstall(serverId);
        }
        else {
            self.getServer(serverId, function(err, server) {
                runInstall(server);
            });
        }

        function runInstall(server) {
            async.series([
                function(asyncCallback) {
                    self.log.verbose('Installing Bender on ' + server.getFriendlyLabel());
                    self._execSshCommand({
                        host: server.getPrivateIp(),
                        command: 'npm -g install https://github.com/clipboard/bender/tarball/master',
                        label: server.getFriendlyLabel()
                    }, function(err) {
                        if (err) {
                            self.log.error('Unable to install bender via npm', err);
                        }

                        asyncCallback(err);
                    });
                },
                function(asyncCallback) {
                    var options = {
                        file: configFile,
                        user: 'root',
                        host: server.getPrivateIp(),
                        port: '22',
                        path: '/usr/lib/node_modules/bender/lib'
                    };

                    self.log.verbose('Setting Bender Config on ' + server.getFriendlyLabel());

                    scp.send(options, function(err) {
                        if (err) {
                            self.log.error('Unable to set bender config', {
                                error: err,
                                server: serverId,
                                configFile: configFile
                            });
                        }

                        asyncCallback(err);
                    });
                },
                function(asyncCallback) {
                    self.log.verbose('Bootstrapping on ' + server.getFriendlyLabel());
                    self.execServerCommand(serverId, 'bootstrap', asyncCallback);
                },
                function(asyncCallback) {
                    self.log.verbose('Updating Global Whitelist');
                    self.updateServerWhitelists(asyncCallback);
                }],
                callback);
        }
    },

    authenticateServerOnPuppet: function(server, callback) {
        var self = this;

        if (typeof(server) === 'object') {
            authenticate(server);
        }
        else {
            self.getServer(server, function(err, server) {
                authenticate(server);
            });
        }

        function authenticate(server) {

            async.series([
            function(asyncCallback) {
                self._execSshCommand({
                    host: server.getPrivateIp(),
                    command: 'puppet agent --test',
                    label: server.getFriendlyLabel()
                }, function(err) {
                    if (err) {
                        self.log.error('Error during initial puppet run for server: ' + server.getFriendlyLabel(), err);
                    }

                    asyncCallback(err);
                });
            },
            function(asyncCallback) {
                self._execSshCommand({
                    host: self.config.bootstrap.puppet.master,
                    command: 'puppet cert --sign --all',
                    label: 'puppet master'
                }, function(err) {
                    if (err) {
                        self.log.error('Error signing puppet for new server: ' + server.getFriendlyLabel(), err);
                    }

                    asyncCallback(err);
                });
            },
            function(asyncCallback) {
                self._execSshCommand({
                    host: server.getPrivateIp(),
                    command: 'puppet agent --test',
                    label: server.getFriendlyLabel()
                }, function(err) {
                    if (err) {
                        self.log.error('Error during puppet run for server ' + server.getFriendlyLabel(), err);
                    }

                    asyncCallback(err);
                });
            }
            ], function(err) {
                if (err) {
                    self.log.error('Some errors during puppet authentication', err);
                }

                callback();
            });
        }
    },

    updateBender: function(configPath, callback) {
        var self = this;

        self.getServers(function(err, servers) {
            if (err) {
                callback(err);
                return;
            }

            async.forEachLimit(servers, 10, function(server, next) {
                self.installBender(server, configPath, next);
            }, function(err) {
                if (err) {
                    self.log.error('Unable to update bender on all servers', err);
                }

                callback(err);
            });
        });
    },

    updateServerWhitelists: function(callback) {
        var self = this;

        self.getServers(function(err, servers) {
            if (err) {
                callback(err);
                return;
            }

            async.forEachLimit(servers, 10, function(server, next) {
                self.log.verbose('Whitelisting ' + server.getFriendlyLabel());
                self.execServerCommand(server, 'whitelist', next);
            }, function(err) {
                if (err) {
                    self.log.error('Unable to whitelist all servers', err);
                }

                callback(err);
            });
        });
    },

    _configureLogging: function(fileLog) {
        var self = this;

        var myCustomLevels = {
            levels: {
                debug: 0,
                verbose: 1,
                info: 2,
                warn: 3,
                error: 4
            },
            colors: {
                debug: 'blue',
                verbose: 'cyan',
                info: 'green',
                warn: 'yellow',
                error: 'red'
            }
        };

        var transports = [];

        if (fileLog) {
            transports.push(new winston.transports.File({
                filename: '/var/log/bender-server.log',
                levelDecorators: ['[', ']'],
                level: self.config.logLevel,
                colorize: true,
                timestamp: true,
                debugToStdOut: true
            }));
        }
        else {
            transports.push(new winston.transports.Console({
                levelDecorators: ['[', ']'],
                level: self.config.logLevel,
                colorize: true,
                timestamp: false,
                debugToStdOut: true
            }));
        }


        self.log = new winston.Logger({
            levels: myCustomLevels.levels,
            transports: transports
        });

        winston.addColors(myCustomLevels.colors);
    }
};

// We break our different modules into different files, then we extend the
// prototype of the client based on the merged functions

var prototype = _.extend({},
    core);

_.each(prototype, function(value, key) {
    Client.prototype[key] = value;
});
