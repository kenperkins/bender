var async = require('async'),
    iptables = require('iptables'),
    fs = require('fs'),
    _ = require('underscore');

exports.Server = {
   whitelistServers: function(iface, privateOnly) {
       var self = this;

       // default to private only for safety
       if (typeof(privateOnly) !== 'boolean') {
           privateOnly = true;
       }

       console.log(('Whitelisting Servers... (Private Only: ' + privateOnly + ')\n').cyan);

       // target rule
       // iptables -A INPUT -i eth1 -s $ip -d 0.0.0.0/0 -j ACCEPT

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
               process.exit(err ? 1 : 0);
           });
       });
   },

   bootstrap: function(serverId) {

       var self = this;

       self.bender.getServer(serverId, function(err, server) {
           if (err) {
               console.log('Unable to get server');
               process.exit(1);
               return;
           }

           server.environment.getPrivateDomain(function(err, privateDomain) {
               if (err) {
                   console.log('Unable to get domain');
                   process.exit(1);
                   return;
               }

               this._checkFileForValue('/etc/resolv.conf', 'domain ', privateDomain.name);
               this._checkFileForValue('/etc/puppet/puppet.conf', 'server=', 'puppet.chicago.il.private.test.clpbrd.com');
               this._checkFileForValue('/etc/puppet/puppet.conf', 'environment=', server.environment.name);
           });
       });
   },

   _checkFileForValue: function(file, prefix, newValue) {
       var resolv = fs.readFileSync(file).toString().split('\n'),
           output = '',
           found = false;

       for (var i = 0; i < resolv.length; i++) {
           if (resolv[i].substr(0, prefix.length) === prefix) {
               resolv[i] = prefix + newValue;
               found = true;
           }
       }

       _.each(resolv, function(line) {
           output += line + '\n';
       });

       if (!found) {
           output += prefix + newValue;
       }

       fs.writeFileSync(file, output);
   }
};
