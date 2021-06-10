// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useState } from "react";

import { LocalLayoutStorage, LocalLayoutStorageContext } from "@foxglove/studio-base";

export default function NoOpLayoutStorageProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const [ctx] = useState<LocalLayoutStorage>(() => {
    return {
      async list() {
        return [];
      },
      async get() {
        return undefined;
      },
      async put() {
        return undefined;
      },
      async delete() {
        return undefined;
      },
    };
  });

  return (
    <LocalLayoutStorageContext.Provider value={ctx}>
      {props.children}
    </LocalLayoutStorageContext.Provider>
  );
}
