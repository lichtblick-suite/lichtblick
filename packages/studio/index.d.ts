// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "@foxglove/studio" {
  import { Time } from "rosbag";

  import { RosMsgField } from "@foxglove/rosmsg";

  export type RosDatatype = {
    fields: RosMsgField[];
  };

  export type RosDatatypes = {
    [key: string]: RosDatatype;
  };

  // Represents a ROS topic, though the actual data does not need to come from a ROS system.
  export type Topic = {
    // Of ROS topic format, i.e. "/some/topic". We currently depend on this slashes format a bit in
    // `<MessageHistroy>`, though we could relax this and support arbitrary strings. It's nice to have
    // a consistent representation for topics that people recognize though.
    name: string;
    // Name of the datatype (see `type PlayerStateActiveData` for details).
    datatype: string;
    // The original topic name, if the topic name was at some point renamed, e.g. in
    // RenameDataProvider.
    originalTopic?: string;
    // The number of messages present on the topic. Valid only for sources with a fixed number of
    // messages, such as bags.
    numMessages?: number;
  };

  // Metadata about the source of data currently being displayed.
  // This is not expected to change often, usually when changing data sources.
  export type DataSourceInfo = {
    topics: readonly Topic[];
    datatypes: RosDatatypes;
    capabilities: string[];
    startTime?: Time; // Only `startTime`, since `endTime` can change rapidly when connected to a live system.
    playerId: string;
  };

  // A message event frames message data with the topic and receive time
  export type MessageEvent<T> = Readonly<{
    topic: string;
    receiveTime: Time;
    message: T;
  }>;

  export type ExtensionPanelRegistration = {
    // Unique name of the panel within your extension
    //
    // NOTE: Panel names within your extension must be unique. The panel name identifies this panel
    // within a layout. Changing the panel name will cause layouts using the old name unable to load
    // your panel.
    name: string;

    // Panel component
    component: () => JSX.Element;
  };

  export interface ExtensionContext {
    /** The current _mode_ of the application. */
    readonly mode: "production" | "development" | "test";

    registerPanel(params: ExtensionPanelRegistration): void;
  }

  export interface ExtensionActivate {
    (extensionContext: ExtensionContext): void;
  }

  // ExtensionModule describes the interface your extension entry level module must export
  // as its default export
  export interface ExtensionModule {
    activate: ExtensionActivate;
  }

  // The entire public API interface
  interface StudioApi {
    panel: {
      /**
       * useMessagesByTopic makes it easy to request some messages on some topics.
       *
       * Using this hook will cause the panel to re-render when new messages arrive on the requested topics.
       * - During file playback the panel will re-render when the file is playing or when the user is scrubbing.
       * - During live playback the panel will re-render when new messages arrive.
       */
      useMessagesByTopic(params: {
        topics: readonly string[];
        historySize: number;
        preloadingFallback?: boolean;
      }): Record<string, readonly MessageEvent<unknown>[]>;

      /**
       * Load/Save panel configuration. This behaves in a manner similar to React.useState except the state
       * is persisted with the current layout.
       */
      useConfig<Config>(): [Config, (config: Partial<Config>) => void];

      /**
       * Data source info" encapsulates **rarely-changing** metadata about the source from which
       * Studio is loading data.
       *
       * A data source might be a local file, a remote file, or a streaming source.
       */
      useDataSourceInfo(): DataSourceInfo;
    };
  }

  // Individual apis are exposed as constants
  // This is to support a pattern of `import { panel } from "@foxglove/studio"`

  /**
   * APIs for use within panels
   */
  export const panel: StudioApi["panel"];

  export = StudioApi;
}
