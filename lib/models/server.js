var _ = require('underscore');

module.exports = function(sequelize, DataTypes) {
    return sequelize.define("server", {
            name       : DataTypes.STRING,
            status     : DataTypes.STRING,
            providerHostId: DataTypes.STRING,
            providerFlavorId: DataTypes.INTEGER,
            providerImageId: DataTypes.STRING,
            providerRecordId: DataTypes.STRING
        },
        {
            classMethods   : {

            },
            instanceMethods: {
                getPrivateIp: function() {
                    var self = this;

                    if (!self.addresses) {
                        return null;
                    }

                    for (var i = 0; i < self.addresses.length; i++) {
                        var address = self.addresses[i];

                        if (!address.isPublic) {
                            return address.ipAddress;
                        }
                    }
                },
                getFriendlyLabel: function() {
                    var label = this.name;

                    if (this.environment) {
                        label += ' [' + this.environment.name + ']';
                    }

                    return label;
                }
            }
        });
};