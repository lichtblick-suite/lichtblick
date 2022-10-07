// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "@foxglove/studio" {
  // Valid types for parameter data (such as rosparams)
  export type ParameterValue =
    | undefined
    | boolean
    | number
    | string
    | Date
    | Uint8Array
    | ParameterValue[]
    | ParameterStruct;

  export type ParameterStruct = Record<string, ParameterValue>;

  // Valid types for global variables
  export type VariableValue =
    | undefined
    | boolean
    | number
    | string
    | VariableValue[]
    | VariableStruct;

  export type VariableStruct = Record<string, VariableValue>;

  // Valid types for application settings
  export type AppSettingValue = string | number | boolean | undefined;

  export interface Time {
    sec: number;
    nsec: number;
  }

  /**
   * A topic is a namespace for specific types of messages
   */
  export type Topic = {
    /**
     * topic name i.e. "/some/topic"
     */
    name: string;
    /**
     * @deprecated Renamed to `schemaName`. `datatype` will be removed in a future release.
     */
    datatype: string;
    /**
     * The schema name is an identifier for the types of messages on this topic. Typically this is the
     * fully-qualified name of the message schema. The fully-qualified name depends on the data source
     * and data loaded by the data source.
     *
     * i.e. `package.Message` in protobuf-like serialization or `pkg/Msg` in ROS systems.
     */
    schemaName: string;
  };

  export type Subscription = {
    topic: string;

    /**
     * Setting preload to _true_ hints to the data source that it should attempt to load all available
     * messages for the topic. The default behavior is to only load messages for the current frame.
     *
     * **Only** topics with `preload: true` are available in the `allFrames` render state.
     */
    preload?: boolean;
  };

  /**
   * A message event frames message data with the topic and receive time
   */
  export type MessageEvent<T> = Readonly<{
    /** The topic name this message was received on, i.e. "/some/topic" */
    topic: string;
    /**
     * The schema name is an identifier for the schema of the message within the message event.
     */
    schemaName: string;
    /**
     * The time in nanoseconds this message was received. This may be set by the
     * local system clock or the data source, depending on the data source used
     * and whether time is simulated via a /clock topic or similar mechanism.
     * The timestamp is often nanoseconds since the UNIX epoch, but may be
     * relative to another event such as system boot time or simulation start
     * time depending on the context.
     */
    receiveTime: Time;
    /**
     * The time in nanoseconds this message was originally published. This is
     * only available for some data sources. The timestamp is often nanoseconds
     * since the UNIX epoch, but may be relative to another event such as system
     * boot time or simulation start time depending on the context.
     */
    publishTime?: Time;
    /** The deserialized message as a JavaScript object. */
    message: T;
    /**
     * The approximate size of this message in its serialized form. This can be
     * useful for statistics tracking and cache eviction.
     */
    sizeInBytes: number;
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
     * True if the data source performed a seek. This indicates that some data may have been skipped
     * (never appeared in the `currentFrame`), so panels should clear out any stale state to avoid
     * displaying incorrect data.
     */
    didSeek?: boolean;

    /**
     * All available messages. Best-effort list of all available messages.
     */
    allFrames?: readonly MessageEvent<unknown>[];

    /**
     * Map of current parameter values. Parameters are key/value pairs associated with the data
     * source, and may not be available for all data sources. For example, ROS 1 live connections
     * support parameters through the Parameter Server <http://wiki.ros.org/Parameter%20Server>.
     */
    parameters?: ReadonlyMap<string, ParameterValue>;

    /**
     * Map of current Studio variables. Variables are key/value pairs that are globally accessible
     * to panels and scripts in the current layout. See
     * <https://foxglove.dev/docs/studio/app-concepts/variables> for more information.
     */
    variables?: ReadonlyMap<string, VariableValue>;

    /**
     * List of available topics. This list includes subscribed and unsubscribed topics.
     */
    topics?: readonly Topic[];

    /**
     * A timestamp value indicating the current playback time.
     */
    currentTime?: Time;

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

    /** Application settings. This will only contain subscribed application setting key/values */
    appSettings?: ReadonlyMap<string, AppSettingValue>;
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
     * Identifies the semantics of the data being played back, such as which topics or parameters
     * are semantically meaningful or normalization conventions to use. This typically maps to a
     * shorthand identifier for a robotics framework such as "ros1", "ros2", or "ulog". See the MCAP
     * profiles concept at <https://github.com/foxglove/mcap/blob/main/docs/specification/appendix.md#well-known-profiles>.
     */
    readonly dataSourceProfile?: string;

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
     * Set the value of parameter name to value.
     *
     * @param name The name of the parameter to set.
     * @param value The new value of the parameter.
     */
    setParameter: (name: string, value: ParameterValue) => void;

    /**
     * Set the value of variable name to value.
     *
     * @param name The name of the variable to set.
     * @param value The new value of the variable.
     */
    setVariable: (name: string, value: VariableValue) => void;

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
     *
     * Subscribe will update the current subscriptions to the list of topic names. Passing an empty
     * array will unsubscribe from all topics.
     *
     * Calling subscribe with an empty array of topics is analagous to unsubscribeAll.
     */
    subscribe(topics: string[]): void;

    /**
     * Subscribe to an array of topics with additional options for each subscription.
     */
    subscribe(subscriptions: Subscription[]): void;

    /**
     * Unsubscribe from all topics.
     *
     * Note: This is analagous to calling subscribe([]) with an empty array of topics.
     */
    unsubscribeAll(): void;

    /**
     * Subscribe to any changes in application settings for an array of setting names.
     */
    subscribeAppSettings(settings: string[]): void;

    /**
     * Indicate intent to publish messages on a specific topic.
     *
     * @param topic The topic on which the extension will publish messages.
     * @param schemaName The name of the schema that the published messages will conform to.
     * @param options Options passed to the current data source for additional configuration.
     */
    advertise?(topic: string, schemaName: string, options?: Record<string, unknown>): void;

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
     * Call a service.
     *
     * @param service The name of the service to call
     * @param request The request payload for the service call
     * @returns A promise that resolves when the result is available or rejected with an error
     */
    callService?(service: string, request: unknown): Promise<unknown>;

    /**
     * Process render events for the panel. Each render event receives a render state and a done callback.
     * Render events occur frequently (60hz, 30hz, etc).
     *
     * The done callback should be called once the panel has rendered the render state.
     */
    onRender?: (renderState: Readonly<RenderState>, done: () => void) => void;

    /**
     * Updates the panel's settings editor. Call this every time you want to update
     * the representation of the panel settings in the editor.
     */
    updatePanelSettingsEditor(settings: Readonly<SettingsTree>): void;
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

  export type SettingsIcon =
    | "Add"
    | "Background"
    | "Camera"
    | "Cells"
    | "Check"
    | "Circle"
    | "Clock"
    | "Collapse"
    | "Cube"
    | "Delete"
    | "Expand"
    | "Flag"
    | "Folder"
    | "FolderOpen"
    | "Grid"
    | "Hive"
    | "ImageProjection"
    | "Map"
    | "Move"
    | "MoveDown"
    | "MoveUp"
    | "NorthWest"
    | "Note"
    | "NoteFilled"
    | "Points"
    | "PrecisionManufacturing"
    | "Radar"
    | "Settings"
    | "Shapes"
    | "Share"
    | "Star"
    | "SouthEast"
    | "Timeline"
    | "Topic"
    | "Walk"
    | "World";

  /**
   * A settings tree field specifies the input type and the value of a field
   * in the settings editor.
   */
  export type SettingsTreeFieldValue =
    | { input: "autocomplete"; value?: string; items: string[] }
    | { input: "boolean"; value?: boolean }
    | {
        input: "rgb";
        value?: string;

        /**
         * Optional placeholder text displayed in the field input when value is undefined
         */
        placeholder?: string;

        /**
         * Optional field that's true if the clear button should be hidden.
         */
        hideClearButton?: boolean;
      }
    | {
        input: "rgba";
        value?: string;

        /**
         * Optional placeholder text displayed in the field input when value is undefined
         */
        placeholder?: string;

        /**
         * Optional field that's true if the clear button should be hidden.
         */
        hideClearButton?: boolean;
      }
    | { input: "gradient"; value?: [string, string] }
    | { input: "messagepath"; value?: string; validTypes?: string[] }
    | {
        input: "number";
        value?: number;
        step?: number;
        max?: number;
        min?: number;
        precision?: number;

        /**
         * Optional placeholder text displayed in the field input when value is undefined
         */
        placeholder?: string;
      }
    | {
        input: "select";
        value?: number | number[];
        options: Array<{ label: string; value: undefined | number }>;
      }
    | {
        input: "select";
        value?: string | string[];
        options: Array<{ label: string; value: undefined | string }>;
      }
    | {
        input: "string";
        value?: string;

        /**
         * Optional placeholder text displayed in the field input when value is undefined
         */
        placeholder?: string;
      }
    | {
        input: "toggle";
        value?: string;
        options: string[] | Array<{ label: string; value: undefined | string }>;
      }
    | {
        input: "vec3";
        value?: [undefined | number, undefined | number, undefined | number];
        placeholder?: [undefined | string, undefined | string, undefined | string];
        step?: number;
        precision?: number;
        labels?: [string, string, string];
        max?: number;
        min?: number;
      }
    | {
        input: "vec2";
        value?: [undefined | number, undefined | number];
        placeholder?: [undefined | string, undefined | string];
        step?: number;
        precision?: number;
        labels?: [string, string];
        max?: number;
        min?: number;
      };

  export type SettingsTreeField = SettingsTreeFieldValue & {
    /**
     * True if the field is disabled.
     */
    disabled?: boolean;

    /**
     * Optional help text to explain the purpose of the field.
     */
    help?: string;

    /**
     * The label displayed alongside the field.
     */
    label: string;

    /**
     * True if the field is readonly.
     */
    readonly?: boolean;

    /**
     * Optional message indicating any error state for the field.
     */
    error?: string;
  };

  export type SettingsTreeFields = Record<string, undefined | SettingsTreeField>;

  export type SettingsTreeChildren = Record<string, undefined | SettingsTreeNode>;

  export type SettingsTreeNodeActionItem = {
    type: "action";

    /**
     * A unique idenfier for the action.
     */
    id: string;

    /**
     * A descriptive label for the action.
     */
    label: string;

    /**
     * Optional icon to display with the action.
     */
    icon?: SettingsIcon;
  };

  export type SettingsTreeNodeActionDivider = { type: "divider" };

  /**
   * An action included in the action menu for a settings node.
   */
  export type SettingsTreeNodeAction = SettingsTreeNodeActionItem | SettingsTreeNodeActionDivider;

  export type SettingsTreeNode = {
    /**
     * An array of actions that can be performed on this node.
     */
    actions?: SettingsTreeNodeAction[];

    /**
     * Other settings tree nodes nested under this node.
     */
    children?: SettingsTreeChildren;

    /**
     * Set to collapsed if the node should be initially collapsed.
     */
    defaultExpansionState?: "collapsed" | "expanded";

    /**
     * Optional message indicating any error state for the node.
     */
    error?: string;

    /**
     * Field inputs attached directly to this node.
     */
    fields?: SettingsTreeFields;

    /**
     * Optional icon to display next to the node label.
     */
    icon?: SettingsIcon;

    /**
     * An optional label shown at the top of this node.
     */
    label?: string;

    /**
     * True if the node label can be edited by the user.
     */
    renamable?: boolean;

    /**
     * Optional sort order to override natural object ordering. All nodes
     * with a sort order will be rendered before nodes all with no sort order.
     *
     * Nodes without an explicit order will be ordered according to ECMA
     * object ordering rules.
     *
     * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
     */
    order?: number | string;

    /**
     * An optional visibility status. If this is not undefined, the node
     * editor will display a visiblity toggle button and send update actions
     * to the action handler.
     **/
    visible?: boolean;

    /**
     * Filter Children by visibility status
     */
    enableVisibilityFilter?: boolean;
  };

  /**
   * Distributes Pick<T, K> across all members of a union, used for extracting structured
   * subtypes.
   */
  type DistributivePick<T, K extends keyof T> = T extends unknown ? Pick<T, K> : never;

  /**
   * Represents actions that can be dispatched to source of the SettingsTree to implement
   * edits and updates.
   */
  export type SettingsTreeAction =
    | {
        action: "update";
        payload: { path: readonly string[] } & DistributivePick<
          SettingsTreeFieldValue,
          "input" | "value"
        >;
      }
    | {
        action: "perform-node-action";
        payload: { id: string; path: readonly string[] };
      };

  export type SettingsTreeNodes = Record<string, undefined | SettingsTreeNode>;

  /**
   * A settings tree is a tree of panel settings that can be displayed and edited in
   * the panel settings sidebar.
   */
  export type SettingsTree = {
    /**
     * Handler to process all actions on the settings tree initiated by the UI.
     */
    actionHandler: (action: SettingsTreeAction) => void;

    /**
     * True if the settings editor should show the filter control.
     */
    enableFilter?: boolean;

    /**
     * The settings tree root nodes. Updates to these will automatically be reflected in the
     * editor UI.
     */
    nodes: SettingsTreeNodes;
  };
}
