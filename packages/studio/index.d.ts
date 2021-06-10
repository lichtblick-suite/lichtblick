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

  /**
   * A message event frames message data with the topic and receive time
   */
  export type MessageEvent<T> = Readonly<{
    topic: string;
    receiveTime: Time;
    message: T;
  }>;

  export interface RenderState {
    /**
     * The latest messages for the current render frame. These are new messages since the last render frame.
     */
    currentFrame?: readonly MessageEvent<unknown>[];

    /**
     * All available messages. Best-effort list of all available messages.
     */
    allFrames?: readonly MessageEvent<unknown>[];

    /**
     * List of available topics. This list includes subscribed and unsubscribed topics.
     */
    topics?: readonly Topic[];
  }

  export type PanelExtensionContext = {
    /**
     * The root element for the panel. Add your panel elements as children under this element.
     */
    readonly panelElement: HTMLDivElement;

    /**
     * Initial panel state
     */
    readonly initialState: unknown;

    /**
     * Subscribe to updates on this field within the render state. Render will only be invoked when
     * this field changes.
     */
    watch: (field: keyof RenderState) => void;

    /**
     * Save arbitrary object as persisted panel state. This state is persisted for the panel
     * within a layout.
     *
     * The state value should be JSON serializable.
     */
    saveState: (state: Partial<unknown>) => void;

    /**
     * Process render events for the panel. Each render event receives a render state and a done callback.
     * Render events occur frequently (60hz, 30hz, etc).
     *
     * The done callback should be called once the panel has rendered the render state.
     */
    onRender?: (renderState: Readonly<RenderState>, done: () => void) => void;

    /**
     * Subscribe to an array of topic names.
     */
    subscribe(topics: string[]): void;

    /**
     * Unsubscribe from all topics.
     */
    unsubscribeAll(): void;
  };

  export type ExtensionPanelRegistration = {
    // Unique name of the panel within your extension
    //
    // NOTE: Panel names within your extension must be unique. The panel name identifies this panel
    // within a layout. Changing the panel name will cause layouts using the old name unable to load
    // your panel.
    name: string;

    // This function is invoked when your panel is initialized
    initPanel: (context: PanelExtensionContext) => void;
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
}
