/** @type {import('jest').Config} */
const preset = require("../config/jest-preset");

module.exports = {
  ...preset,
  rootDir: "src",
};
