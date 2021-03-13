// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mapValues } from "lodash";
import { PropsWithChildren, useMemo, useState } from "react";

import ExperimentalFeaturesContext, {
  ExperimentalFeaturesBackend,
  FeatureDescriptions,
  getDefaultKey,
} from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import Storage from "@foxglove-studio/app/util/Storage";
import logEvent, { getEventNames } from "@foxglove-studio/app/util/logEvent";

export const EXPERIMENTAL_FEATURES_STORAGE_KEY = "experimentalFeaturesSettings";

export type FeatureStorage = {
  [id: string]: "alwaysOn" | "alwaysOff";
};
export default function ExperimentalFeaturesLocalStorageProvider({
  children,
  features,
}: PropsWithChildren<{ features: FeatureDescriptions }>): React.ReactElement {
  const [featureStorage, setFeatureStorage] = useState(
    () => new Storage().getItem<FeatureStorage>(EXPERIMENTAL_FEATURES_STORAGE_KEY) ?? {},
  );

  const settings = useMemo(
    () =>
      mapValues(features, (description, id) =>
        featureStorage[id] === "alwaysOn" || featureStorage[id] === "alwaysOff"
          ? { enabled: featureStorage[id] === "alwaysOn", manuallySet: true }
          : { enabled: description[getDefaultKey()], manuallySet: false },
      ),
    [features, featureStorage],
  );

  const backend: ExperimentalFeaturesBackend = {
    settings,
    features,
    changeFeature(id, value) {
      const storage = new Storage();
      const newStorage: FeatureStorage = { ...storage.getItem(EXPERIMENTAL_FEATURES_STORAGE_KEY) };

      logEvent({
        // @ts-expect-error Event logging is not currently well typed
        name: getEventNames().CHANGE_EXPERIMENTAL_FEATURE as string | undefined,
        tags: { feature: id, value },
      });

      if (value === "default") {
        delete newStorage[id];
      } else {
        newStorage[id] = value;
      }
      storage.setItem(EXPERIMENTAL_FEATURES_STORAGE_KEY, newStorage);
      setFeatureStorage(newStorage);
    },
  };
  return (
    <ExperimentalFeaturesContext.Provider value={backend}>
      {children}
    </ExperimentalFeaturesContext.Provider>
  );
}
