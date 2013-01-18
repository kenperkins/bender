var async = require('async'),
    _ = require('underscore');

exports.Create = {
    createEnvironment: function() {

        var self = this,
            details = {},
            environments,
            choice;

        async.series([
            // get list of current environments
            function(callback) {
                self.bender.getEnvironments(function(err, envs) {
                    environments = envs;
                    callback(err);
                });
            },
            // display list of environments
            function(callback) {
                self.listEnvironments(callback);
            },
            // prompt for environment name
            function(callback) {
                console.log('\nCreate a new environment'.bold.yellow);

                var nameRegex = '^[a-z][a-z0-9\-]+$';

                function promptForName(err) {
                    self.app.prompt('\n  Name: ', function(name) {

                        if (err) {
                            console.log(err.error.red);
                        }

                        if (name.match(nameRegex)) {
                            details.name = name;
                            callback();
                        }
                        else {
                            promptForName({ error: '  Please enter a valid name'});
                        }
                    });
                }

                promptForName();
            },
            // prompt for import of existing domains or create new
            function(callback) {
                console.log('\n  Import existing domains from rackspace, or create new domains\n'.yellow);

                var list = ['Import', 'Create'];
                self.app.choose(list, function(i) {
                    choice = list[i].toLowerCase();
                    callback();
                });
            },
            //
            function(callback) {
                if (choice === 'import') {
                    doImport();
                }
                else {
                    doCreate();
                }

                function doImport() {

                    var importPublic, importPrivate;

                    console.log('  Loading domains...'.cyan);
                    self.bender.rackspace.getDomains(function(err, domains) {
                        if (err || !domains || !domains.length || domains.length === 1) {
                            console.log('  Insufficient domains found.'.red);
                            doCreate();
                            return;
                        }
                        console.log('\n  Select Domain for private addresses:'.bold.yellow);
                        console.log('    This will be used for creating DNS records for the private interfaces,'.data);
                        console.log('    for example, web-01.private.mydomain.com\n'.data);

                        self.app.choose(_.map(domains, function(domain) {
                            return domain.name.yellow;
                        }), function(i) {
                            importPrivate = domains[i];
                            domains.splice(i, 1);
                            console.log('\n  Select Domain for public addresses:'.bold.yellow);
                            console.log('    This will be used for creating DNS records for the public interfaces,'.data);
                            console.log('    for example, web-01.mydomain.com\n'.data);
                            self.app.choose(_.map(domains, function(domain) {
                                return domain.name.yellow;
                            }), function(i) {
                                importPublic = domains[i];

                                async.parallel([
                                    function(parallelCallback) {
                                        self.bender.importDomain(importPublic.id, function(err, publicDomain) {
                                            if (err) {
                                                console.log('Unable to import domain', {
                                                    error: err,
                                                    domain: importPublic
                                                });
                                                parallelCallback(err);
                                                return;
                                            }

                                            details.publicDomain = publicDomain;
                                            parallelCallback();
                                        });
                                    },
                                    function(parallelCallback) {
                                        self.bender.importDomain(importPrivate.id, function(err, privateDomain) {
                                            if (err) {
                                                console.log('Unable to import domain', {
                                                    error: err,
                                                    domain: importPublic
                                                });
                                                parallelCallback(err);
                                                return;
                                            }

                                            details.privateDomain = privateDomain;
                                            parallelCallback();
                                        });
                                    }], function(err) {
                                    callback(err);
                                });
                            });
                        });
                    });
                }

                function doCreate() {
                    callback({error: 'Not Yet Implemented'});
                }

            },
            function(callback) {
                self.bender.createEnvironment(details, function(err, env) {
                    if (err) {
                        console.log('Unable to create environment'.red);
                    }
                    else {
                        console.log('Successfully created environment ' + env.name.green);
                    }

                    callback(err);
                });
            }
        ], function(err) {
            if (err) {
                process.exit(1);
            }
            else {
                process.exit(0);
            }
        });
    },

    createService: function() {

        var self = this,
            details = {};

        async.series([
            // prompt for service name
            function(callback) {
                console.log('\nCreate a new service'.bold.yellow);

                var nameRegex = '^[a-z0-9A-Z\-]+$';

                function promptForName(err) {
                    self.app.prompt('\n Friendly Name: ', function(name) {

                        if (err) {
                            console.log(err.error.red);
                        }

                        if (name.match(nameRegex)) {
                            details.name = name;
                            callback();
                        }
                        else {
                            promptForName({ error: '  Please enter a valid name'});
                        }
                    });
                }

                promptForName();
            },
            // prompt for service type
            function(callback) {
                console.log('\n  What type of service is this?\n'.yellow);

                var list = ['Upstart', 'Init'];
                self.app.choose(list, function(i) {
                    details.type = list[i].toLowerCase();
                    callback();
                });
            },
            // prompt for allowing reload
            function(callback) {
                console.log('\n  Does this service support reload?\n'.yellow);

                var list = ['Yes', 'No'];
                self.app.choose(list, function(i) {
                    details.reload = list[i].toLowerCase() === 'yes';
                    callback();
                });
            },
            function(callback) {
                console.log('\n  What is the service name?\n'.yellow);

                var nameRegex = '^[a-z0-9A-Z\-]+$';

                function promptForName(err) {
                    self.app.prompt('\n Service Name: ', function(name) {

                        if (err) {
                            console.log(err.error.red);
                        }

                        if (name.match(nameRegex)) {
                            details.serviceName = name;
                            callback();
                        }
                        else {
                            promptForName({ error: '  Please enter a valid name'});
                        }
                    });
                }

                promptForName();

            },
            function(callback) {
                self.bender.createService(details, function(err, service) {
                    if (err) {
                        console.log('Unable to create service'.red);
                    }
                    else {
                        console.log('Successfully created service ' + service.name.green);
                    }

                    callback(err);
                });
            }
        ], function(err) {
            if (err) {
                process.exit(1);
            }
            else {
                process.exit(0);
            }
        });
    },

    createProvider: function() {

        var self = this,
            providers,
            providerName;

        async.series([
            // display list of environments
            function(callback) {
                self.listProviders(function(err, provs) {
                    if (err) {
                        console.dir(err);
                        callback(err);
                        return;
                    }

                    providers = provs;
                    callback();
                });
            },
            // prompt for environment name
            function(callback) {
                console.log('\nCreate a new provider'.bold.yellow);

                var nameRegex = '^[a-zA-Z0-9\-]+$';

                function promptForName(err) {
                    self.app.prompt('\n  Name: ', function(name) {

                        if (err) {
                            console.log(err.error.red);
                        }

                        if (name.match(nameRegex)) {
                            providerName = name;
                            callback();
                        }
                        else {
                            promptForName({ error: '  Please enter a valid name'});
                        }
                    });
                }

                promptForName();
            },
            function(callback) {
                self.bender.createProvider(providerName, function(err, provider) {
                    if (err) {
                        console.log('Unable to create provider'.red);
                    }
                    else {
                        console.log('Successfully created provider ' + provider.name.green);
                    }

                    callback(err);
                });
            }
        ], function(err) {
            if (err) {
                process.exit(1);
            }
            else {
                process.exit(0);
            }
        });
    },

    createServer: function() {
        var self = this,
            options = {},
            diskOptions = ['Local Storage', 'Block SATA', 'Block SSD'];

        async.series([
            function(callback) {
                console.log('\nCreate a new Server'.bold.yellow);

                var nameRegex = '^[a-z][a-z0-9\-]+$';

                function promptForName(err) {
                    self.app.prompt('\n  Name: ', function(name) {

                        if (err) {
                            console.log(err.error.red);
                        }

                        if (name.match(nameRegex)) {
                            options.name = name;
                            callback();
                        }
                        else {
                            promptForName({ error: '  Please enter a valid name'});
                        }
                    });
                }

                promptForName();
            },
            function(callback) {

                self.bender.getEnvironments(function(err, envs) {

                    console.log('\n  Please choose an environment:'.bold.yellow);
                    console.log('    Your environment can be changed later but is not'.data);
                    console.log('    Recommended. It\'s easier to delete and add a new VM'.data);
                    console.log('    in the appropriate environment.\n'.data);
                    self.app.choose(_.map(envs, function(env) {
                        return env.name.yellow;
                    }), function(i) {
                        options.environment = envs[i];
                        callback();
                    });
                });
            },
            function(callback) {

                console.log('\nLoading Sizes...'.cyan);

                self.bender.rackspace.getFlavors(function(err, flavors) {

                    console.log('\n  Please choose a VM size:'.bold.yellow);
                    console.log('    VMs can be resized at any time after creation,'.data);
                    console.log('    whether it\'s larger or smaller than the initial size.\n'.data);
                    self.app.choose(_.map(flavors, function(flavor) {
                        return flavor.name.yellow;
                    }), function(i) {
                        options.flavor = flavors[i];
                        callback();
                    });
                });
            },
            function(callback) {

                console.log('\nLoading Images...'.cyan);

                self.bender.rackspace.getImages(function(err, images) {

                    console.log('\n  Please choose a VM image:'.bold.yellow);
                    console.log('    This image will be used when creating the new'.data);
                    console.log('    Virutal Machine. You can rebuild to a different image'.data);
                    console.log('    at any time.'.data);
                    self.app.choose(_.map(images, function(image) {
                        return image.name.yellow;
                    }), function(i) {
                        options.image = images[i];
                        callback();
                    });
                });
            },
            function(callback) {
                console.log('\n  Please choose a disk type:'.bold.yellow);
                console.log('    Disks can either be local spindals (shared), or '.data);
                console.log('    Block Storage SSD or SATA drives.'.data);
                self.app.choose(_.map(diskOptions, function(option) {
                    return option.yellow;
                }), function(i) {
                    options.drive = diskOptions[i];
                    callback();
                });
            },
            function(callback) {
                if (options.drive === 'Local Storage') {
                    callback();
                    return;
                }

                console.log('\n  Please choose a disk disk (100-1000):'.bold.yellow);
                console.log('    Size is in Gigabytes. Minimum of 100.'.data);

                function promptForSize(err) {
                    self.app.prompt('\n  Size: ', function(sizeInput) {

                        if (err) {
                            console.log(err.error.red);
                        }

                        var size = parseInt(sizeInput);

                        if (isNaN(size) || (!isNaN(size) && size > 1000 || size < 100)) {
                            promptForSize({ error: '  Please enter a size from 100-1000'});

                        }
                        else {
                            options.driveSize = size;
                            callback();
                        }
                    });
                }

                promptForSize();
            },
            function(callback) {
                console.log('\n  Please select services for this server:'.bold.yellow);

                self.bender.getServices(function(err, services) {

                    options.services = [];

                    function addService() {

                        var serviceOptions = _.map(services, function(service) {
                            return service.name;
                        });

                        serviceOptions.push('Done');

                        self.app.choose(_.map(serviceOptions, function(service) {
                            return service.yellow;
                        }), function(i) {
                            var service = serviceOptions[i];

                            if (service === 'Done') {
                                callback();
                                return;
                            }

                            _.each(services, function(realService, index) {
                                if (service === realService) {
                                    console.log('\n  Selected: '.bold.yellow + realService.name.cyan);

                                    options.services.push(realService);

                                    services.splice(index, 1);
                                }
                            });

                            addService();
                        });
                    }

                    addService();
                });
            },
            function(callback) {
                console.dir(_.map(options.services, function(service) {
                    return service.name;
                }));
                return;
                self.bender.createServer(options, function(err, result) {

                    if (err) {
                        console.log('Errors during server creation!'.red, err);
                    }

                    if (result) {
                        console.log('  Successfully created server '.cyan + result.server.name.green);
                        console.log('  Admin Password (not saved): '.cyan + result.adminPassword.green);
                        _.each(result.addresses, function(addr) {
                            if (addr.type === 'IPV4') {
                                return;
                            }
                            console.log('    ' + (addr.isPublic ? 'Public IP: ' : 'Private IP: ').cyan + addr.ipAddress.green);
                            if (addr.dnsRecords) {
                                console.log('      ' + addr.dnsRecords[0].name.green);
                            }
                        });
                    }

                    callback(err);
                });
            }
        ],
            function(err) {
                if (err) {
                    process.exit(1);
                }
                else {
                    process.exit(0);
                }
        });
    }
};
