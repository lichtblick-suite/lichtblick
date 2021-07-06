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
     * Set the active preview time. Setting the preview time to undefined clears the preview time.
     */
    setPreviewTime: (time: number | undefined) => void;

    /**
     * Seek playback to the given time. Behaves as if the user had clicked the playback bar to seek.
     */
    seekPlayback?: (time: number) => void;

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
