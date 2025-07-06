import { SettingsTreeAction, SettingsTreeNodes } from "@lichtblick/suite";
import { Config } from "./types";
export declare const defaultConfig: Config;
export declare function settingsActionReducer(prevConfig: Config, action: SettingsTreeAction): Config;
export declare function useSettingsTree(config: Config): SettingsTreeNodes;
