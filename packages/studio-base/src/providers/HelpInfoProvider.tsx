// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useCallback, useRef } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import HelpInfoContext, {
  IHelpInfo,
  HelpInfo,
} from "@foxglove/studio-base/context/HelpInfoContext";

export const DEFAULT_HELP_INFO: HelpInfo = {
  title: "",
  content: undefined,
};

export default function HelpInfoProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const helpInfo = useRef<HelpInfo>(DEFAULT_HELP_INFO);
  const helpInfoListeners = useRef(new Set<(_: HelpInfo) => void>());
  const addHelpInfoListener = useCallback((listener: (_: HelpInfo) => void) => {
    helpInfoListeners.current.add(listener);
  }, []);
  const removeHelpInfoListener = useCallback((listener: (_: HelpInfo) => void) => {
    helpInfoListeners.current.delete(listener);
  }, []);

  const getHelpInfo = useCallback((): HelpInfo => helpInfo.current, []);
  const setHelpInfo = useCallback((info: HelpInfo): void => {
    helpInfo.current = info;
    for (const listener of [...helpInfoListeners.current]) {
      listener(helpInfo.current);
    }
  }, []);

  const value: IHelpInfo = useShallowMemo({
    getHelpInfo,
    setHelpInfo,
    addHelpInfoListener,
    removeHelpInfoListener,
  });

  return <HelpInfoContext.Provider value={value}>{children}</HelpInfoContext.Provider>;
}
