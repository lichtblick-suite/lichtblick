// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "@foxglove/roslibjs" {
  type RosOptions = {
    url: string;
    transportLibrary: "workersocket";
  };

  class Ros {
    public constructor(options: RosOptions);

    public on(eventName: "connection", cb: () => void): void;
    public on(eventName: "close", cb: () => void): void;
    // eslint-disable-next-line no-restricted-syntax
    public on(eventName: "error", cb: (err: Error | null) => void): void;

    public getNodes(cb: (nodes: string[]) => void, errorCallback: (error: Error) => void): void;

    public getNodeDetails(
      node: string,
      cb: (subscriptions: string[], publications: string[], services: string[]) => void,
      errorCallback: (error: Error) => void,
    ): void;

    public getTopicsAndRawTypes(
      cb: (result: { topics: string[]; types: string[]; typedefs_full_text: string[] }) => void,
      errorCallback: (error: Error) => void,
    ): void;

    public getServiceType(
      service: string,
      cb: (result: string) => void,
      errorCallback: (error: Error) => void,
    ): void;

    public close(): void;
  }

  type Message = Record<string, unknown>;

  type TopicOptions = {
    ros: Ros;
    name: string;
    messageType?: string;
    compression?: "cbor" | "cbor-raw" | "png" | "none";
    queue_size?: number;
  };

  class Topic {
    public constructor(options: TopicOptions);
    public publish(msg: Message): void;
    public subscribe(cb: (msg: Message) => void): void;
    public unsubscribe(): void;
    public unadvertise(): void;
  }

  type ServiceOptions = {
    ros: Ros;
    name: string;
    serviceType: string;
  };

  class Service {
    public constructor(options: ServiceOptions);
    public callService(
      request: Message,
      cb: (response: Message) => void,
      errorCallback: (error: Error) => void,
    ): void;
  }

  export { Ros, Topic, Service };
}
