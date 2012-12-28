module.exports = function(sequelize, DataTypes) {
    return sequelize.define("service", {
            name       : DataTypes.STRING,
            type       : DataTypes.STRING,
            doesReload : DataTypes.BOOLEAN,
            serviceName: DataTypes.STRING
        },
        {
            classMethods   : {

            },
            instanceMethods: {

            }
        });
};