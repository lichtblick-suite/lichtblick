import { Time } from "@lichtblick/rostime";
import { Immutable, SettingsTreeAction, SettingsTreeNodeActionItem } from "@lichtblick/suite";
import { MessageAndData } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
import { TimestampMethod } from "@lichtblick/suite-base/util/time";
export type StateTransitionPath = {
    color?: string;
    value: string;
    label?: string;
    enabled?: boolean;
    timestampMethod: TimestampMethod;
};
export type StateTransitionConfig = {
    isSynced: boolean;
    paths: StateTransitionPath[];
    xAxisMaxValue?: number;
    xAxisMinValue?: number;
    xAxisRange?: number;
    showPoints?: boolean;
};
export type StateTransitionPanelProps = {
    config: StateTransitionConfig;
    saveConfig: SaveConfig<StateTransitionConfig>;
};
export type PathLegendProps = {
    paths: StateTransitionPath[];
    heightPerTopic: number;
    setFocusedPath: (value: string[] | undefined) => void;
    saveConfig: SaveConfig<StateTransitionConfig>;
};
export interface IUsePanelSettings {
    actionHandler: (action: SettingsTreeAction) => void;
}
export type PathState = {
    path: StateTransitionPath;
    isArray: boolean;
};
export type AxisTreeField = {
    value: number | undefined;
    label: string;
    error?: string | undefined;
};
export type SeriesAction = Pick<SettingsTreeNodeActionItem, "label" | "icon" | "id">;
export declare enum SeriesActionId {
    ADD = "add-series",
    DELETE = "delete-series"
}
export type MessageDatasetArgs = {
    path: StateTransitionPath;
    startTime: Time;
    y: number;
    pathIndex: number;
    blocks: readonly (readonly MessageAndData[] | undefined)[];
    showPoints: boolean;
};
export type ValidQueriedDataValue = number | string | boolean | bigint;
export type ImmutableDataset = Immutable<(MessageAndData[] | undefined)[]>;
