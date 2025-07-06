/// <reference types="react" />
declare const _default: import("react").ComponentType<{
    childId?: string | undefined;
    overrideConfig?: {} | undefined;
    tabId?: string | undefined;
} & Omit<{
    config: {};
    saveConfig: import("../../types/panels").SaveConfig<{}>;
}, "config" | "saveConfig">> & import("@lichtblick/suite-base/components/Panel").PanelStatics<{}>;
export default _default;
