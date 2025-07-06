import { PlayerMetricsCollectorInterface } from "@lichtblick/suite-base/players/types";
export default class NoopMetricsCollector implements PlayerMetricsCollectorInterface {
    setProperty(_key: string, _value: string | number | boolean): void;
    playerConstructed(): void;
}
