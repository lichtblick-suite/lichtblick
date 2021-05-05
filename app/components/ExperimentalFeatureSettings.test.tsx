/** @jest-environment jsdom */
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
import { mount } from "enzyme";

import { ExperimentalFeatureSettings } from "@foxglove-studio/app/components/ExperimentalFeatureSettings";
import { useExperimentalFeature } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import ExperimentalFeaturesLocalStorageProvider, {
  EXPERIMENTAL_FEATURES_STORAGE_KEY,
} from "@foxglove-studio/app/context/ExperimentalFeaturesLocalStorageProvider";
import ThemeProvider from "@foxglove-studio/app/theme/ThemeProvider";
import Storage from "@foxglove-studio/app/util/Storage";

const features = {
  feat1: {
    name: "Feature 1",
    description: "Description 1",
    developmentDefault: true,
    productionDefault: false,
  },
  feat2: {
    name: "Feature 2",
    description: "Description 2",
    developmentDefault: true,
    productionDefault: false,
  },
  feat3: {
    name: "Feature 3",
    description: "Description 3",
    developmentDefault: true,
    productionDefault: false,
  },
  feat4: {
    name: "Feature 4",
    description: "Description 4",
    developmentDefault: true,
    productionDefault: false,
  },
};

describe("ExperimentalFeatures", () => {
  it("exposes experimental features using useExperimentalFeature", async () => {
    new Storage().setItem(EXPERIMENTAL_FEATURES_STORAGE_KEY, {
      feat1: "alwaysOn",
      feat2: "alwaysOff",
      feat3: "invalid value",
    });

    const renderedSettings: { [key in keyof typeof features]?: boolean } = {};
    let renderCount = 0;
    function RenderExperimentalFeatures() {
      renderCount++;
      renderedSettings.feat1 = useExperimentalFeature("feat1");
      renderedSettings.feat2 = useExperimentalFeature("feat2");
      renderedSettings.feat3 = useExperimentalFeature("feat3");
      renderedSettings.feat4 = useExperimentalFeature("feat4");
      return ReactNull;
    }

    const container = mount(
      <ThemeProvider>
        <ExperimentalFeaturesLocalStorageProvider features={features}>
          <RenderExperimentalFeatures />
          <div data-modalcontainer>
            <ExperimentalFeatureSettings />
          </div>
        </ExperimentalFeaturesLocalStorageProvider>
      </ThemeProvider>,
    );
    expect(renderCount).toEqual(1);
    expect(renderedSettings).toEqual({
      feat1: true,
      feat2: false,
      feat3: true,
      feat4: true,
    });

    // Clicking on an item in the modal should trigger a rerender of all components that use
    // `useExperimentalFeature`, and so the `renderedSettings` should be updated with the new value.
    container
      .find("input")
      .at(2)
      .simulate("change", { target: { checked: true } });
    expect(renderCount).toEqual(2);
    expect(renderedSettings).toEqual({
      feat1: false,
      feat2: false,
      feat3: true,
      feat4: true,
    });
    expect(new Storage().getItem(EXPERIMENTAL_FEATURES_STORAGE_KEY)).toEqual({
      feat1: "alwaysOff",
      feat2: "alwaysOff",
      feat3: "invalid value",
    });

    new Storage().removeItem(EXPERIMENTAL_FEATURES_STORAGE_KEY);
  });
});
