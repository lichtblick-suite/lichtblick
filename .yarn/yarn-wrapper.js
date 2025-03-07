#!/usr/bin/env node

// This script does some pre-configure checks and environment setup for yarn runs

const path = require("path");

if (process.env.COREPACK_ROOT == undefined) {
  console.error("This repository uses corepack. Enable corepack by running `corepack enable`");
  console.error("Learn more at: https://nodejs.org/api/corepack.html");
  console.error("");
  console.error(
    "If you have run `corepack enable` and still see this error, you have likely installed yarn globally or using your system package manager. Your installed version of yarn is superseding corepack's version. Delete or uninstall your version of yarn to use the corepack version.",
  );
  process.exit(1);
}

// Increases the v8 old memory space (effectively increasing v8 heap space beyond the 2GB default)
process.env.NODE_OPTIONS = "--max-old-space-size=6144";

const yarncmd = path.join(process.env.COREPACK_ROOT, "dist", "yarn.js");
require(yarncmd);
