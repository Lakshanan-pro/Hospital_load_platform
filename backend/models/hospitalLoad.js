const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Hospital = require("./hospital");

const HospitalLoad = sequelize.define("HospitalLoad", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Hospital,
      key: "id",
    },
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  estimated_wait: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  crowd_level: {
    type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH"),
    defaultValue: "MEDIUM",
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "hospital_load",
  timestamps: false,
});

Hospital.hasMany(HospitalLoad, { foreignKey: "hospital_id" });
HospitalLoad.belongsTo(Hospital, { foreignKey: "hospital_id" });

module.exports = HospitalLoad;
