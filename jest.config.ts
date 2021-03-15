// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Or top level jest config to reference all the projects under our monorepo
export default {
  // We exclude the integration test since it involves performing a webpack build and
  // doesn't support "watch" or "debug" in the same way
  projects: ["<rootDir>/app/jest.config.ts", "<rootDir>/packages/**/jest.config.ts"],
};
