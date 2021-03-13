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

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { loadLayout } from "@foxglove-studio/app/actions/panels";
import ShareJsonModal from "@foxglove-studio/app/components/ShareJsonModal";
import { State } from "@foxglove-studio/app/reducers";
import { PanelsState } from "@foxglove-studio/app/reducers/panels";

type Props = {
  onRequestClose: () => void;
};

function LayoutModal({ onRequestClose }: Props) {
  const panels = useSelector((state: State) => state.persistedState.panels);
  const dispatch = useDispatch();

  const onChange = useCallback(
    (layoutPayload: PanelsState) => {
      dispatch(loadLayout(layoutPayload));
    },
    [dispatch],
  );

  return (
    <ShareJsonModal
      onRequestClose={onRequestClose}
      value={panels}
      onChange={onChange}
      noun="layout"
    />
  );
}

export default LayoutModal;
