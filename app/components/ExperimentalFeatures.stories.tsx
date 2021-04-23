// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { action } from "@storybook/addon-actions";
import { ReactElement } from "react";

import { ExperimentalFeatureSettings } from "@foxglove-studio/app/components/ExperimentalFeatureSettings";
import ExperimentalFeaturesContext, {
  FeatureDescriptions,
  FeatureSettings,
} from "@foxglove-studio/app/context/ExperimentalFeaturesContext";

export default {
  title: "components/ExperimentalFeatures",
  component: ExperimentalFeatureSettings,
  parameters: {
    chromatic: {
      viewport: { width: 1000, height: 1300 },
    },
  },
};

const dummyFeatures: FeatureDescriptions = {
  feat1: {
    name: "Feature 1",
    description: "Example description 1",
    developmentDefault: true,
    productionDefault: false,
  },
  feat2: {
    name: "Feature 2",
    description: "Example description 2",
    developmentDefault: false,
    productionDefault: true,
  },
  feat3: {
    name: "Feature 3",
    description: "Example description 3",
    developmentDefault: true,
    productionDefault: false,
  },
  feat4: {
    name: "Feature 4",
    description: "Example description 4",
    developmentDefault: true,
    productionDefault: false,
  },
};

const dummySettings: FeatureSettings = {
  feat1: { enabled: true, manuallySet: false },
  feat2: { enabled: false, manuallySet: false },
  feat3: { enabled: true, manuallySet: true },
  feat4: { enabled: false, manuallySet: true },
};

export function EmptyList(): ReactElement {
  return (
    <ExperimentalFeaturesContext.Provider
      value={{ features: {}, settings: {}, changeFeature: action("changeFeature") }}
    >
      <ExperimentalFeatureSettings />
    </ExperimentalFeaturesContext.Provider>
  );
}

export function BasicFixture(): ReactElement {
  return (
    <ExperimentalFeaturesContext.Provider
      value={{
        features: dummyFeatures,
        settings: dummySettings,
        changeFeature: action("changeFeature"),
      }}
    >
      <ExperimentalFeatureSettings />
    </ExperimentalFeaturesContext.Provider>
  );
}
