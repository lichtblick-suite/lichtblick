import { Immutable } from "@lichtblick/suite";
import { SharedPanelState } from "@lichtblick/suite-base/context/CurrentLayoutContext";
/**
 * Returns a [state, setState] pair that can be used to read and update shared transient
 * panel state.
 */
export declare function useSharedPanelState(): [
    Immutable<SharedPanelState>,
    (data: Immutable<SharedPanelState>) => void
];
