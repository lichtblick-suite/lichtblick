// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useRef, ReactNode } from "react";
import { Provider } from "react-redux";

import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore";

type Store = ReturnType<typeof configureStore>;

type Props = {
  children: ReactNode;
  store?: Store;
};

export default function StoreSetup(props: Props): JSX.Element {
  const storeRef = useRef(props.store ?? configureStore(createRootReducer()));

  return <Provider store={storeRef.current}>{props.children}</Provider>;
}
