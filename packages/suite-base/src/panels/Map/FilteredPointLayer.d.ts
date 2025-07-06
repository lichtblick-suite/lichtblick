import { Map, LatLngBounds, FeatureGroup } from "leaflet";
import { MessageEvent } from "@lichtblick/suite-base/players/types";
import "leaflet-ellipse";
import { NavSatFixMsg } from "./types";
export declare const POINT_MARKER_RADIUS = 3;
type Args = {
    map: Map;
    bounds: LatLngBounds;
    color: string;
    hoverColor: string;
    showAccuracy?: boolean;
    navSatMessageEvents: readonly MessageEvent<NavSatFixMsg>[];
    onHover?: (event: MessageEvent<NavSatFixMsg> | undefined) => void;
    onClick?: (event: MessageEvent<NavSatFixMsg>) => void;
};
/**
 * Create a leaflet LayerGroup with filtered points
 */
declare function FilteredPointLayer(args: Args): FeatureGroup;
export default FilteredPointLayer;
