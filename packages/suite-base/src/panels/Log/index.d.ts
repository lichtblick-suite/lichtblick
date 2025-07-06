/// <reference types="react" />
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
import { Config } from "./types";
type Props = {
    config: Config;
    saveConfig: SaveConfig<Config>;
};
declare const _default: import("react").ComponentType<{
    childId?: string | undefined;
    overrideConfig?: Config | undefined;
    tabId?: string | undefined;
} & Omit<Props, "config" | "saveConfig">> & import("@lichtblick/suite-base/components/Panel").PanelStatics<Config>;
export default _default;
