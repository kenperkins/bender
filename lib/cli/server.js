var async = require('async'),
    iptables = require('iptables'),
    exec = require('child_process').exec,
    fs = require('fs'),
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

            var privateIP = '';

            _.each(server.addresses, function(addr) {
                if (!addr.isPublic) {
                    privateIP = addr.ipAddress;
                }
            });

            // default to private only for safety
            if (typeof(privateOnly) !== 'boolean') {
                privateOnly = true;
            }

            console.log(('Whitelisting Servers... (Private Only: ' + privateOnly + ')\n').cyan);

            // target rule
            // iptables -A INPUT -i eth1 -s $ip -d 0.0.0.0/0 -j ACCEPT

            // Baseline rules for all servers
            iptables.policy('INPUT', 'DROP');
            iptables.policy('FORWARD', 'DROP');
            iptables.policy('OUTPUT','ACCEPT');

            // Flush all existing rules
            iptables.newRule({ chain: 'INPUT', action: '-F'});
            iptables.newRule({ chain: 'OUTPUT', action: '-F'});
            iptables.newRule({ chain: 'FORWARD', action: '-F'});

            // Accept anything on loopback
            iptables.allow({ src: '127.0.0.1', dst: '127.0.0.1', 'in': 'lo' });
            iptables.allow({ src: privateIP, dst: privateIP });

            // Allow outbound packets if state related and inbound if established
            iptables.allow({ chain: 'OUTPUT', state: 'NEW,ESTABLISHED,RELATED' });
            iptables.allow({ chain: 'INPUT', state: 'ESTABLISHED' });
            iptables.allow({ chain: 'INPUT', state: 'ESTABLISHED,RELATED' });

            // Temporarily allow SSH
            iptables.allow({ chain: 'INPUT', protocol: 'tcp', dport: 22 });

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
                iptables.newRule({ action: '-A', 'in': 'eth0', protocol: 'tcp', tcpFlags: flags });
            });

            self.bender.getServers(function(err, servers) {
                async.forEach(servers, function(server, next) {
                    console.log('  Processing Server: '.data + server.name.green + (' [' + server.environment.name + ']').data);
                    async.forEach(server.addresses, function(address, nestedCallback) {
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
                                    'in': iface
                                });
                                console.log('    Whitelisting: '.data + address.ipAddress.green);
                                nestedCallback();
                            }
                            catch (e) {
                                console.log('    Skipping: '.data + address.ipAddress.green);
                                nestedCallback();
                            }
                        }
                    }, function(err) {
                        next();
                    });
                }, function(err) {
                    exec('iptables-save > /etc/firewall.conf', function(err) {
                        process.exit(err ? 1 : 0);
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
