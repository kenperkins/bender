module.exports = function(sequelize, DataTypes) {
    return sequelize.define("environment", {
            name            : {
                type: DataTypes.STRING,
                unique: true
            }
        },
        {
            classMethods   : {

            },
            instanceMethods: {

            }
        });
};