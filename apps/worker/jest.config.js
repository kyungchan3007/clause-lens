/** @type {import('jest').Config} */
const preset = require("../../packages/config/jest-preset");

module.exports = {
  ...preset,
  rootDir: "src",
};
