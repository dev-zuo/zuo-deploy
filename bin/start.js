#!/usr/bin/env node

const ZuoDeploy = require("../index.js");

module.exports = function start(args) {
  let zuoDeploy = new ZuoDeploy();

  zuoDeploy.start(args);
};
