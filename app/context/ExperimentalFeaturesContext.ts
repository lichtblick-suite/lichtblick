// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export type FeatureDescriptions = {
  [id: string]: {
    name: string;
    description: string | React.ReactNode;
    developmentDefault: boolean;
    productionDefault: boolean;
  };
};

export type FeatureValue = "default" | "alwaysOn" | "alwaysOff";
export type FeatureSettings = {
  [id: string]: { enabled: boolean; manuallySet: boolean };
};

export type ExperimentalFeaturesBackend = {
  features: FeatureDescriptions;
  settings: FeatureSettings;
  changeFeature: (id: string, value: FeatureValue) => void;
};
const ExperimentalFeaturesContext = createContext<ExperimentalFeaturesBackend>({
  features: {},
  settings: {},
  changeFeature: () => {},
});

export function getDefaultKey(): "productionDefault" | "developmentDefault" {
  return process.env.NODE_ENV === "production" ? "productionDefault" : "developmentDefault";
}

export function useExperimentalFeature(id: string): boolean {
  const { settings } = useContext(ExperimentalFeaturesContext);
  return settings[id]?.enabled ?? false;
}

export default ExperimentalFeaturesContext;
