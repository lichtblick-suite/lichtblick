#!/usr/bin/env node

// This script does some pre-configure checks and environment setup for yarn runs

const path = require("path");

if (process.env.COREPACK_ROOT == undefined) {
  console.error("This repository uses corepack. Enable corepack by running `corepack enable`");
  console.error("Learn more at: https://nodejs.org/api/corepack.html");
  process.exit(1);
}

// Increases the v8 old memory space (effectively increasing v8 heap space beyond the 2GB default)
process.env.NODE_OPTIONS = "--max-old-space-size=6144";

const yarncmd = path.join(process.env.COREPACK_ROOT, "dist", "yarn.js");
require(yarncmd);
