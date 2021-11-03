// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "@foxglove/studio" {
  export interface Time {
    sec: number;
    nsec: number;
  }

  // A topic is a namespace for specific types of messages
  export type Topic = {
    // topic name i.e. "/some/topic"
    name: string;
    // topic datatype
    datatype: string;
  };

  /**
   * A message event frames message data with the topic and receive time
   */
  export type MessageEvent<T> = Readonly<{
    topic: string;
    receiveTime: Time;
    message: T;
  }>;

  export interface LayoutActions {
    /** Open a new panel or update an existing panel in the layout.  */
    addPanel(params: {
      /**
       * Where to position the panel. Currently, only "sibling" is supported which indicates the
       * new panel will be adjacent to the calling panel.
       */
      position: "sibling";

      /**
       * The type of panel to open. For internal panels, this corresponds to the `static panelType`.
       * For extension panels, this `"extensionName.panelName"` where extensionName is the `name`
       * field from the extension's package.json, and panelName is the name provided to
       * `registerPanel()`.
       */
      type: string;

      /**
       * Whether to update an existing sibling panel of the same type, if it already exists. If
       * false, a new panel will always be added.
       */
      updateIfExists: boolean;

      /**
       * A function that returns the state for the new panel. If updating an existing panel, the
       * existing state will be passed in.
       * @see `updateIfExists`
       */
      getState(existingState?: unknown): unknown;
    }): void;
  }

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

    /**
     * A seconds value indicating a preview time. The preview time is set when a user hovers
     * over the seek bar or when a panel sets the preview time explicitly. The preview time
     * is a seconds value within the playback range.
     *
     * i.e. A plot panel may set the preview time when a user is hovering over the plot to signal
     * to other panels where the user is currently hovering and allow them to render accordingly.
     */
    previewTime?: number | undefined;

    /** The color scheme currently in use throughout the app. */
    colorScheme?: "dark" | "light";
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

    /** Actions the panel may perform related to the user's current layout. */
    readonly layout: LayoutActions;

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
     * Set the active preview time. Setting the preview time to undefined clears the preview time.
     */
    setPreviewTime: (time: number | undefined) => void;

    /**
     * Seek playback to the given time. Behaves as if the user had clicked the playback bar to seek.
     */
    seekPlayback?: (time: number) => void;

    /**
     * Subscribe to an array of topic names.
     */
    subscribe(topics: string[]): void;

    /**
     * Unsubscribe from all topics.
     */
    unsubscribeAll(): void;

    /**
     * Indicate intent to advertise on a specific topic and datatype.
     *
     * The options object is passed to the current data source for additional configuration.
     */
    advertise?(topic: string, datatype: string, options?: Record<string, unknown>): void;

    /**
     * Indicate that you no longer want to advertise on this topic.
     */
    unadvertise?(topic: string): void;

    /**
     * Publish a message on a given topic. You must first advertise on the topic before publishing.
     *
     * @param topic The name of the topic to publish the message on
     * @param message The message to publish
     */
    publish?(topic: string, message: unknown): void;

    /**
     * Process render events for the panel. Each render event receives a render state and a done callback.
     * Render events occur frequently (60hz, 30hz, etc).
     *
     * The done callback should be called once the panel has rendered the render state.
     */
    onRender?: (renderState: Readonly<RenderState>, done: () => void) => void;
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
