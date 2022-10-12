// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Fragment, ReactNode, useCallback } from "react";

import {
  PanelSettingsEditorStore,
  usePanelSettingsEditorStore,
} from "@foxglove/studio-base/context/PanelSettingsEditorContext";

/**
 * Wrapper component used to force-remount the panel when key properties like the tabId
 * or settings sequence number change.
 */
export function PanelRemounter({
  children,
  id,
  tabId,
}: {
  children: ReactNode;
  id: string;
  tabId: undefined | string;
}): JSX.Element {
  const selector = useCallback(
    (store: PanelSettingsEditorStore) => store.sequenceNumbers[id] ?? 0,
    [id],
  );
  const sequenceNumber = usePanelSettingsEditorStore(selector);

  return <Fragment key={`${id}${tabId ?? ""}${sequenceNumber}`}>{children}</Fragment>;
}
