#!/usr/bin/env node

const program = require("commander");

program
  .version(require("../package.json").version)
  .command("start", "Start zuo-deploy server, listening on 7777");

program.parse(process.argv);
