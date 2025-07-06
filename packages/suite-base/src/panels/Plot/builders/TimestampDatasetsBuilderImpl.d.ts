import { Immutable, Time } from "@lichtblick/suite";
import { CsvDataset, SeriesConfigKey, SeriesItem, Viewport } from "./IDatasetsBuilder";
import { Dataset } from "../types";
import { Datum } from "../utils/datum";
export type DataItem = Datum & {
    receiveTime: Time;
    headerStamp?: Time;
};
type ResetSeriesFullAction = {
    type: "reset-full";
    series: SeriesConfigKey;
};
type ResetSeriesCurrentAction = {
    type: "reset-current";
    series: SeriesConfigKey;
};
type UpdateSeriesCurrentAction = {
    type: "append-current";
    series: SeriesConfigKey;
    items: DataItem[];
};
type UpdateSeriesFullAction = {
    type: "append-full";
    series: SeriesConfigKey;
    items: DataItem[];
};
type UpdateSeriesConfigAction = {
    type: "update-series-config";
    seriesItems: SeriesItem[];
};
export type UpdateDataAction = UpdateSeriesConfigAction | ResetSeriesFullAction | ResetSeriesCurrentAction | UpdateSeriesCurrentAction | UpdateSeriesFullAction;
export declare class TimestampDatasetsBuilderImpl {
    #private;
    getViewportDatasets(viewport: Immutable<Viewport>): Dataset[];
    getCsvData(): CsvDataset[];
    applyActions(actions: Immutable<UpdateDataAction[]>): void;
    applyAction(action: Immutable<UpdateDataAction>): void;
}
export {};
