var async = require('async'),
    iptables = require('iptables-tx'),
    Iptables = iptables.Iptables,
    rules = iptables.rules,
    chains = iptables.chains,
    exec = require('child_process').exec,
    fs = require('fs'),
    nginxConf = require('nginx-conf').NginxConfFile,
    _ = require('underscore');

exports.Server = {
    whitelistServer: function(serverId, iface, privateOnly) {
        var self = this;

        self.bender.getServer(serverId, function(err, server) {

            if (err || !server) {
                self.log.error('Unable to find server', err);
                process.exit(1);
                return;
            }

            server.getServices().done(function(err, services) {
                if (err || !server) {
                    self.log.error('Unable to find server', err);
                    process.exit(1);
                    return;
                }

                self.bender.getServers(function(err, servers) {
                    if (err || !servers) {
                        self.log.error('Unable to find servers', err);
                        process.exit(1);
                        return;
                    }

                    var privateIP = '',
                        fw = new Iptables();

                    _.each(server.addresses, function(addr) {
                        if (!addr.isPublic) {
                            privateIP = addr.ipAddress;
                        }
                    });

                    // default to private only for safety
                    if (typeof(privateOnly) !== 'boolean') {
                        privateOnly = true;
                    }

                    console.log(('      Whitelisting Servers... (Private Only: ' + privateOnly + ')\n').cyan);

                    // target rule
                    // iptables -A INPUT -i eth1 -s $ip -d 0.0.0.0/0 -j ACCEPT

                    fw.init()
                        // Baseline rules for all servers
                        .policy(chains.INPUT, rules.DROP)
                        .policy(chains.FORWARD, rules.DROP)
                        .policy(chains.OUTPUT, rules.ACCEPT)

                        // Flush all existing rules
                        .flush(chains.INPUT)
                        .flush(chains.FORWARD)
                        .flush(chains.OUTPUT)

                        // Accept anything on loopback
                        .allow({ src: '127.0.0.1', dst: '127.0.0.1', 'in': 'lo' })
                        .allow({ src: privateIP, dst: privateIP })

                        // Allow outbound packets if state related and inbound if established
                        .allow({ chain: 'OUTPUT', state: 'NEW,ESTABLISHED,RELATED' })
                        .allow({ chain: 'INPUT', state: 'ESTABLISHED' })
                        .allow({ chain: 'INPUT', state: 'ESTABLISHED,RELATED' });

                    // Drop stealth scans
                    _.each([
                        {
                            mask: 'FIN,SYN,RST,PSH,ACK,URG',
                            comp: 'NONE'
                        },
                        {
                            mask: 'SYN,FIN',
                            comp: 'SYN,FIN'
                        },
                        {
                            mask: 'SYN,RST',
                            comp: 'SYN,RST'
                        },
                        {
                            mask: 'FIN,RST',
                            comp: 'FIN,RST'
                        },
                        {
                            mask: 'ACK,FIN',
                            comp: 'FIN'
                        },
                        {
                            mask: 'ACK,URG',
                            comp: 'URG'
                        }
                    ], function(flags) {
                        fw.newRule(null, '-A', { 'in': 'eth0', protocol: 'tcp', tcpFlags: flags });
                    });

                    // Process our global rules
                    _.each(self.config.firewall.global.allow, function(rule) {
                        if (rule.type === 'multi') {
                            _.each(rule.src, function(ip) {
                                fw.allow({
                                    src: ip,
                                    dst: rule.destination,
                                    'in': rule.iface
                                });
                            });
                        }
                        else if (rule.type === 'serviceBased') {
                            var intersection = _.intersection(rule.serviceNames, _.map(services, function(service) {
                                return service.serviceName;
                            }));

                            if (intersection.length > 0) {
                                _.each(rule.ports, function(port) {
                                    var policy = { chain: 'INPUT', protocol: rule.protocol, dport: port };

                                    if (rule.src) {
                                        _.each(rule.src, function(ip) {
                                            fw.allow(_.extend({
                                                src: ip
                                            }, policy));
                                        });
                                    }
                                    else {
                                        fw.allow(policy);
                                    }
                                });
                            }
                        }
                        else if (rule.type === 'serverBased') {
                            if (server.name === rule.server && server.environment.name === rule.environment) {
                                _.each(rule.ports, function(port) {
                                    var policy = { chain: 'INPUT', protocol: rule.protocol, dport: port };

                                    if (rule.src) {
                                        _.each(rule.src, function(ip) {
                                            fw.allow(_.extend({
                                                src: ip
                                            }, policy));
                                        });
                                    }
                                    else {
                                        fw.allow(policy);
                                    }
                                });
                            }
                        }
                    });

                    async.forEach(servers, function(server, next) {
                        console.log('  Processing Server: '.data + server.name.green +
                            (' [' + server.environment.name + ']').data);

                        _.each(server.addresses, function(address) {
                            if (privateOnly && !address.isPublic) {
                                whitelist();
                            }
                            else if (!privateOnly) {
                                whitelist();
                            }

                            function whitelist() {
                                try {
                                    fw.allow({
                                        src: address.ipAddress,
                                        dst: '0.0.0.0/0',
                                        'in': iface
                                    });
                                    console.log('    Whitelisting: '.data + address.ipAddress.green);
                                }
                                catch (e) {
                                    console.log('    Skipping: '.data + address.ipAddress.green);
                                }
                            }
                        });

                        next();
                    }, function() {
                        fw.commit(function(err, results) {
                            if (err) {
                                console.dir(results.error);
                            }
                            else {
                                console.log('Success!');
                            }
                            exec('iptables-save > /etc/firewall.conf', function(err) {
                                process.exit(err ? 1 : 0);
                            });
                        });

                    });
                });

            });
        });
    },

    bootstrap: function(serverId) {

        var self = this;

        self.log.verbose('Starting Bootstrap for server ' + serverId);
        self.bender.getServer(serverId, function(err, server) {
            if (err) {
                self.log.error('Unable to load server', err);
                process.exit(1);
                return;
            }

            server.environment.getPrivateDomain().done(function(err, privateDomain) {
                if (err) {
                    self.log.error('Unable to get domain');
                    process.exit(1);
                    return;
                }

                self._checkFileForValue(self.config.bootstrap.resolvConf, 'domain ', privateDomain.name);
                self._checkFileForValue(self.config.bootstrap.puppet.conf, 'server=', self.config.bootstrap.puppet.master, '[main]');
                self._checkFileForValue(self.config.bootstrap.puppet.conf, 'environment=', server.environment.name, '[main]');
                exec(['echo', serverId, '>', '/etc/bender-server.id'].join(' '), function(err) {
                    process.exit(err ? 1 : 0);
                });
            });
        });
    },

    update: function() {
        var command = [
            'puppet',
            'agent',
            '--test'];
        exec(command.join(' '), function(err) {
            process.exit(err ? 1 : 0);
        });
    },

    siteUp: function() {
        // for site down, we need to remove two files:
        // clipboard-http and clipboard-https, and then add a link to
        // clipboard-down

        var self = this,
            enabledPath = '/etc/nginx/sites-enabled/',
            availablePath = '/etc/nginx/sites-available/',
            down = 'clipboard-down';

        fs.unlink(enabledPath + down, function(err) {
            if (err) {
                self.log.error('Unable to unlink site down file', err);
                process.exit(1);
                return;
            }

            async.forEach(['clipboard-http', 'clipboard-https'], function(file, next) {
                fs.symlink(availablePath + file, enabledPath + file, next);
            }, function(err) {
                if (err) {
                    self.log.error('Unable to link current site files', err);
                    process.exit(1);
                    return;
                }

                process.exit(0);
            });
        });
    },

    siteDown: function() {
        // for site down, we need to remove two files:
        // clipboard-http and clipboard-https, and then add a link to
        // clipboard-down

        var self = this,
            enabledPath = '/etc/nginx/sites-enabled/',
            availablePath = '/etc/nginx/sites-available/',
            down = 'clipboard-down';

        async.forEach(['clipboard-http', 'clipboard-https'], function(file, next) {
            fs.unlink(enabledPath + file, next);
        }, function(err) {
            if (err) {
                self.log.error('Unable to unlink current site files', err);
                process.exit(1);
                return;
            }

            fs.symlink(availablePath + down, enabledPath + down, function(err) {
                if (err) {
                    self.log.error('Unable to link site down file', err);
                    process.exit(1);
                    return;
                }

                process.exit(0);
            });
        });
    },

    removeFromUpstream: function(serverId) {
        var upstreamPath = '/etc/nginx/sites-enabled/upstream',
            self = this;

        self.bender.getServer(serverId, function(err, server) {
            if (err) {
                self.log.error('Unable to get server ' + serverId, err);
                process.exit(1);
                return;
            }

            server.getFqdn(false, function(err, fqdn) {
                if (err) {
                    self.log.error('Failed to get fqdn for server ' + serverId, err);
                    process.exit(1);
                    return;
                }

                nginxConf.create(upstreamPath, function(err, conf) {
                    if (err) {
                        self.log.error('Unable to laod nginx conf file', err);
                        process.exit(1);
                        return;
                    }
                    
                    conf.on('flushed', function(err) {
                        if (err) {
                            self.log.error('Failed to update the nginx conf file', err);
                            process.exit(1);
                            return;
                        }
                        process.exit(0);
                    });
                    
                    var upstream = conf.nginx.upstream;
                    if (Array.isArray(upstream.server)) {
                        var matchingIndex = -1;
                        for(var i=0; i<upstream.server.length; ++i) {
                            if (upstream.server[i].toString().indexOf(fqdn) !== -1) {
                                matchingIndex = i;
                                break;
                            }
                        }
                        if (matchingIndex === -1) {
                            self.log.error('Did not find "' + fqdn + '" in upstream', null);
                            process.exit(1);
                            return;
                        }
                        upstream._remove('server', matchingIndex);
                    }
                    else {
                        if (upstream.server._value.indexOf(fqdn) === -1) {
                            self.log.error('Did not find ' + fqdn + 'in upstream', null);
                            process.exit(1);
                            return;
                        }
                        upstream._remove('server');
                    }
                });
            });
        });
    },

    addToUpstream: function(serverId, portNumber, maxFails, failTimeout) {
        var upstreamPath = '/etc/nginx/sites-enabled/upstream',
            self = this;

        self.bender.getServer(serverId, function(err, server) {
            if (err) {
                self.log.error('Unable to get server ' + serverId, err);
                process.exit(1);
                return;
            }

            server.getFqdn(false, function(err, fqdn) {
                if (err) {
                    self.log.error('Failed to get fqdn for server ' + serverId, err);
                    process.exit(1);
                    return;
                }

                nginxConf.create(upstreamPath, function(err, conf) {
                    if (err) {
                        self.log.error('Unable to laod nginx conf file', err);
                        process.exit(1);
                        return;
                    }
                    
                    conf.on('flushed', function(err) {
                        if (err) {
                            self.log.error('Failed to update the nginx conf file', err);
                            process.exit(1);
                            return;
                        }
                        process.exit(0);
                    });
                    
                    var upstream = conf.nginx.upstream;
                    upstream._add('server', fqdn + ':' + portNumber + ' max_fails=' + 
                                  maxFails + ' fail_timeout=' + failTimeout + 's');
                });
            });
        });        
    },
    
    execServiceCommand: function(serverId, serviceId, cmd) {
        var self = this;

        self.bender.getServer(serverId, function(err, server) {
            if (err) {
                self.log.error('Unable to get server ' + serverId, err);
                process.exit(1);
                return;
            }

            server.getServices().done(function(err, services) {
                if (err) {
                    self.log.error('Unable to get services for server ' + serverId, err);
                    process.exit(1);
                    return;
                }

                var statusCode = 2;

                async.forEach(services, function(service, next) {
                    if (service.id === parseInt(serviceId)) {
                        var command;

                        if (service.doesReload && cmd === 'restart') {
                            cmd = 'reload';
                        }

                        if (service.type === 'upstart') {
                            command = [
                                cmd,
                                service.serviceName
                            ];
                        }
                        else {
                            command = [
                                '/etc/init.d/' + service.serviceName,
                                cmd
                            ];
                        }

                        exec(command.join(' '), function(err, stdout, stderr) {
                            if (service.type === 'upstart') {
                                checkUpstartStatus(service.serviceName, function(code) {
                                    statusCode = code;
                                    next();
                                });
                            }
                            else {
                                checkInitStatus(service.serviceName, function(code) {
                                    statusCode = code;
                                    next();
                                });
                            }
                        });
                    }
                    else {
                        next();
                    }
                }, function() {
                    process.exit(statusCode);
                });
            });
        });

        function checkInitStatus(serviceName, callback) {
            var command = [
                '/etc/init.d/' + serviceName,
                'status'
            ];

            exec(command.join(' '), function(err, stdout, stderr) {
                if (err && err.code === 127) {
                    callback(2);
                }
                else if (serviceName === 'riak' && stdout.indexOf('pong') !== -1) {
                    callback(0);
                }
                else if ((stdout.indexOf('running') !== -1) && (stdout.indexOf('not') === -1)) {
                    callback(0);
                }
                else {
                    callback(1);
                }
            });
        }

        function checkUpstartStatus(serviceName, callback) {
            var command = [
                'status',
                serviceName,
            ];

            exec(command.join(' '), function(err, stdout, stderr) {
                if (err && err.code === 127) {
                    callback(2);
                }
                else if (stdout.indexOf('start/running') !== -1) {
                    callback(0);
                }
                else if (stdout.indexOf('stop/waiting') !== -1) {
                    callback(1);
                }
                else {
                    callback(2);
                }
            });
        }
    },

    _checkFileForValue: function(file, prefix, newValue, after) {
        var self = this,
            lines = fs.readFileSync(file).toString().split('\n'),
            found = false,
            i = 0;

        self.log.debug('Processing file: ' + file);

        for (i = 0; i < lines.length; i++) {
            if (lines[i].substr(0, prefix.length) === prefix) {
                lines[i] = prefix + newValue;
                found = true;
            }
        }

        if (!found) {
            if (after) {
                for (i = 0; i < lines.length; i++) {
                    if (lines[i] === after) {
                        lines.splice(i+1, 0, prefix + newValue);
                        break;
                    }
                }
            }
            else {
                lines.push(prefix + newValue);
            }
        }

        fs.writeFileSync(file, lines.join('\n'));
    }
};
