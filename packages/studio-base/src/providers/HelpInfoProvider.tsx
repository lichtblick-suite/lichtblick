// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import create, { StoreApi } from "zustand";
import createContext from "zustand/context";

export const DEFAULT_HELP_INFO: HelpInfo = {
  title: "",
  content: undefined,
};

export type HelpInfo = {
  title: string;
  content?: React.ReactNode;
  url?: string;
};

export type HelpInfoStore = {
  helpInfo: HelpInfo;
  getHelpInfo: () => HelpInfo;
  setHelpInfo: (info: HelpInfo) => void;
};

const { Provider, useStore } = createContext<StoreApi<HelpInfoStore>>();

export const useHelpInfo = useStore;

function createHelpInfoStore(): StoreApi<HelpInfoStore> {
  return create((set, get) => ({
    helpInfo: DEFAULT_HELP_INFO,
    getHelpInfo: () => get().helpInfo,
    setHelpInfo: (newInfo: HelpInfo) => set({ helpInfo: newInfo }),
  }));
}

export default function HelpInfoProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  return <Provider createStore={createHelpInfoStore}>{children}</Provider>;
}
