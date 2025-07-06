import { Time } from "@lichtblick/rostime";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
export type AppURLState = {
    ds?: string;
    dsParams?: Record<string, string>;
    dsParamsArray?: Record<string, string[]>;
    layoutId?: LayoutID;
    time?: Time;
};
/**
 * Encodes app state in a URL's query params.
 *
 * @param url The base URL to encode params into.
 * @param urlState The player state to encode.
 * @returns A url with all app state stored as query pararms.
 */
export declare function updateAppURLState(url: URL, urlState: AppURLState): URL;
/**
 * Tries to parse a state url into one of the types we know how to open.
 *
 * @param url URL to try to parse.
 * @returns Parsed URL type or undefined if the url is not a valid URL.
 * @throws Error if URL parsing fails.
 */
export declare function parseAppURLState(url: URL): AppURLState | undefined;
/**
 * Tries to parse app url state from the window's current location.
 */
export declare function windowAppURLState(): AppURLState | undefined;
