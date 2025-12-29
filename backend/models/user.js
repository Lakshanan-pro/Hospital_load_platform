const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM("staff", "admin"),
    defaultValue: "staff",
  },
}, {
  tableName: "users",
  timestamps: false,
});

module.exports = User;
