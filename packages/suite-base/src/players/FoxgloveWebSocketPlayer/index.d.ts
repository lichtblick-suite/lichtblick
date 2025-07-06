import { ParameterValue } from "@lichtblick/suite";
import { Asset } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { AdvertiseOptions, Player, PlayerMetricsCollectorInterface, PlayerState, PublishPayload, SubscribePayload } from "@lichtblick/suite-base/players/types";
export default class FoxgloveWebSocketPlayer implements Player {
    #private;
    constructor({ url, metricsCollector, sourceId, }: {
        url: string;
        metricsCollector: PlayerMetricsCollectorInterface;
        sourceId: string;
    });
    setListener(listener: (arg0: PlayerState) => Promise<void>): void;
    close(): void;
    setSubscriptions(subscriptions: SubscribePayload[]): void;
    setPublishers(publishers: AdvertiseOptions[]): void;
    setParameter(key: string, value: ParameterValue): void;
    publish({ topic, msg }: PublishPayload): void;
    callService(serviceName: string, request: unknown): Promise<unknown>;
    fetchAsset(uri: string): Promise<Asset>;
    setGlobalVariables(): void;
}
