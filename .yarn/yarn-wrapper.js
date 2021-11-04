#!/usr/bin/env node

// This script does some pre-configure checks and environment setup for yarn runs

const path = require("path");
const fs = require("fs");

const REAL_YARN = path.join(__dirname, "releases", "yarn-3.1.0.cjs");

// Increases the v8 old memory space (effectively increasing v8 heap space beyond the 2GB default)
process.env.NODE_OPTIONS = "--max-old-space-size=6144";

// Check for missing Git LFS before attempting to run yarn
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
