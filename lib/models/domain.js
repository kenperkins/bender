module.exports = function(sequelize, DataTypes) {
    return sequelize.define("domain", {
            name: { type: DataTypes.STRING, unique: true },
            providerRecordId: DataTypes.STRING
        },
        {
            classMethods: {
                createDnsRecord: function(type, data, name, callback) {

                }
            },
            instanceMethods: {

            }
        });
};