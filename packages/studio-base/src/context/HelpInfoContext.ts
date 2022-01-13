// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { createContext, useLayoutEffect, useState } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";

export type HelpInfo = {
  title: string;
  content?: React.ReactNode;
  url?: string;
};

export interface IHelpInfo {
  addHelpInfoListener: (listener: (_: HelpInfo) => void) => void;
  removeHelpInfoListener: (listener: (_: HelpInfo) => void) => void;
  getHelpInfo: () => HelpInfo;
  setHelpInfo: (info: HelpInfo) => void;
}

export type HelpInfoActions = {
  getHelpInfo: () => HelpInfo;
  setHelpInfo: (info: HelpInfo) => void;
  helpInfo: HelpInfo;
};

const HelpInfoContext = createContext<IHelpInfo | undefined>(undefined);
HelpInfoContext.displayName = "HelpInfoContext";

export function useHelpInfo(): HelpInfoActions {
  const ctx = useGuaranteedContext(HelpInfoContext);
  const [helpInfo, setHelpInfoState] = useState(() => ctx.getHelpInfo());
  useLayoutEffect(() => {
    const listener = (info: HelpInfo) => setHelpInfoState(info);
    ctx.addHelpInfoListener(listener);
    return () => ctx.removeHelpInfoListener(listener);
  }, [ctx]);

  const setHelpInfo = useGuaranteedContext(HelpInfoContext).setHelpInfo;
  const getHelpInfo = useGuaranteedContext(HelpInfoContext).getHelpInfo;

  return useShallowMemo({
    getHelpInfo,
    setHelpInfo,
    helpInfo,
  });
}

export default HelpInfoContext;
