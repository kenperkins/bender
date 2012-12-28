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

            }
        });
};