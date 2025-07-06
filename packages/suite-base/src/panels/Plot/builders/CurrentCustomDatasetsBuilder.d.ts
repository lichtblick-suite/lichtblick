import { MessagePath } from "@lichtblick/message-path";
import { Immutable } from "@lichtblick/suite";
import { PlayerState } from "@lichtblick/suite-base/players/types";
import { CsvDataset, GetViewportDatasetsResult, HandlePlayerStateResult, IDatasetsBuilder, SeriesItem } from "./IDatasetsBuilder";
/**
 * CurrentCustomDatasetsBuilder builds datasets from a custom x-axis message path and
 * y-axis message path. It uses only the latest message for each path to build the datasets.
 */
export declare class CurrentCustomDatasetsBuilder implements IDatasetsBuilder {
    #private;
    handlePlayerState(state: Immutable<PlayerState>): HandlePlayerStateResult | undefined;
    setXPath(path: Immutable<MessagePath> | undefined): void;
    setSeries(series: Immutable<SeriesItem[]>): void;
    getViewportDatasets(): Promise<GetViewportDatasetsResult>;
    getCsvData(): Promise<CsvDataset[]>;
}
