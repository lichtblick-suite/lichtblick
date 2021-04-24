// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { FeatureDescriptions } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";

export default {
  unlimitedMemoryCache: {
    name: "Unlimited in-memory cache (requires reload)",
    description: <>Fully buffer a bag into memory. This may use up a lot of system memory.</>,
    developmentDefault: false,
    productionDefault: false,
  },
} as FeatureDescriptions;
