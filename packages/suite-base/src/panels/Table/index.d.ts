/// <reference types="react" />
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
type Config = {
    topicPath: string;
};
type Props = {
    config: Config;
    saveConfig: SaveConfig<Config>;
};
declare const _default: import("react").ComponentType<{
    childId?: string | undefined;
    overrideConfig?: {
        topicPath: string;
    } | undefined;
    tabId?: string | undefined;
} & Omit<Props, "config" | "saveConfig">> & import("@lichtblick/suite-base/components/Panel").PanelStatics<{
    topicPath: string;
}>;
export default _default;
