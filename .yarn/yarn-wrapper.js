#!/usr/bin/env node
// This script checks for missing Git LFS before attempting to run yarn

const path = require("path");
const fs = require("fs");

const REAL_YARN = path.join(__dirname, "releases", "yarn-3.0.0-rc.2.cjs");

try {
  if (fs.statSync(REAL_YARN).size < 10000) {
    throw new Error(
      "Foxglove Error: Please configure Git LFS ( https://git-lfs.github.com/ ) " +
        "then run `git lfs pull` before running yarn.",
    );
  }
} catch (e) {
  // Catch missing file or LFS error
  console.error(e.message);
  process.exit(1);
}

// Handoff to real yarn
require(REAL_YARN);
