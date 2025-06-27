# Lichtblick API Documentation

This document provides comprehensive API documentation for developers working with Lichtblick.

## Table of Contents

1. [Extension API](#extension-api)
2. [Panel API](#panel-api)
3. [Player API](#player-api)
4. [Message Types](#message-types)
5. [Data Source API](#data-source-api)
6. [Layout API](#layout-api)
7. [User Script API](#user-script-api)
8. [Event System](#event-system)

## Extension API

The Extension API allows developers to extend Lichtblick functionality through custom panels, message converters, and more.

### ExtensionContext

The main interface provided to extensions during activation.

```typescript
interface ExtensionContext {
  /**
   * Register a custom panel
   * @param panel Panel configuration
   */
  registerPanel(panel: PanelExtensionRegistration): void;

  /**
   * Register a message converter
   * @param converter Converter configuration
   */
  registerMessageConverter(converter: MessageConverter<unknown>): void;

  /**
   * Register a topic alias function
   * @param name Function name
   * @param fn Topic alias function
   */
  registerTopicAliasFunction(
    name: string,
    fn: TopicAliasFunction
  ): void;

  /**
   * Register a custom camera model
   * @param model Camera model configuration
   */
  registerCameraModel(model: CameraModel): void;
}
```

### PanelExtensionRegistration

Configuration for registering a custom panel.

```typescript
interface PanelExtensionRegistration {
  /** Display name for the panel */
  name: string;
  
  /** React component for the panel */
  component: React.ComponentType<{ context: PanelContext }>;
  
  /** Default configuration for new instances */
  defaultConfig?: Record<string, unknown>;
  
  /** Whether multiple instances are supported */
  supportsMultiple?: boolean;
  
  /** Help documentation */
  help?: React.ReactNode;
}
```

### MessageConverter

Transform messages between different schemas.

```typescript
interface MessageConverter<T> {
  /** Source message schema name */
  fromSchema: string;
  
  /** Target message schema name */
  toSchema: string;
  
  /** Conversion function */
  converter: (msg: unknown, event: MessageEvent) => T;
}
```

### Example Extension

```typescript
import { ExtensionContext, PanelContext } from "@lichtblick/suite";

export function activate(context: ExtensionContext): void {
  // Register a custom panel
  context.registerPanel({
    name: "My Custom Panel",
    component: MyPanel,
    defaultConfig: { threshold: 0.5 },
  });

  // Register a message converter
  context.registerMessageConverter({
    fromSchema: "sensor_msgs/CompressedImage",
    toSchema: "sensor_msgs/Image",
    converter: decompressImage,
  });

  // Register a topic alias function
  context.registerTopicAliasFunction(
    "derivative",
    computeDerivative
  );
}

function MyPanel({ context }: { context: PanelContext }): JSX.Element {
  // Panel implementation
}
```

## Panel API

The Panel API provides interfaces for custom panels to interact with the Lichtblick system.

### PanelContext

Core interface for panel functionality.

```typescript
interface PanelContext {
  /** Unique panel instance ID */
  readonly id: string;
  
  /** Panel type identifier */
  readonly type: string;
  
  /** Current panel configuration */
  readonly config: unknown;
  
  /** Panel title in the layout */
  readonly title: string;

  /**
   * Save panel configuration
   * @param config New configuration
   */
  saveConfig(config: unknown): void;

  /**
   * Subscribe to topics
   * @param topics Topic names to subscribe
   */
  subscribe(topics: string[]): void;

  /**
   * Unsubscribe from all topics
   */
  unsubscribeAll(): void;

  /**
   * Watch for state changes
   * @param field Field to watch
   * @returns Unwatch function
   */
  watch(field: "currentFrame" | "allFrames" | "currentTime"): () => void;

  /**
   * Set a global variable
   * @param name Variable name
   * @param value Variable value
   */
  setVariable(name: string, value: unknown): void;

  /**
   * Call a ROS service
   * @param service Service name
   * @param request Request data
   */
  callService(service: string, request: unknown): Promise<unknown>;

  /**
   * Publish a message
   * @param topic Topic name
   * @param message Message data
   */
  publish(topic: string, message: unknown): void;

  /**
   * Render callback
   * Called when new data is available
   */
  onRender?: (renderState: RenderState) => void;
}
```

### RenderState

State provided to panels during render.

```typescript
interface RenderState {
  /** Current messages for subscribed topics */
  currentFrame?: MessageEvent[];
  
  /** All messages in current time window */
  allFrames?: MessageEvent[];
  
  /** Current playback time */
  currentTime?: Time;
  
  /** Preview time (hover) */
  previewTime?: Time;
  
  /** Available topics */
  topics?: Topic[];
  
  /** Global variables */
  variables?: Record<string, unknown>;
  
  /** Color scheme ("light" | "dark") */
  colorScheme?: string;
}
```

### Panel Example

```typescript
function MyPanel({ context }: { context: PanelContext }): JSX.Element {
  const [messages, setMessages] = useState<MessageEvent[]>([]);

  useEffect(() => {
    // Subscribe to topics
    context.subscribe(["/sensor_data", "/status"]);

    // Set up render callback
    context.onRender = (renderState: RenderState) => {
      if (renderState.currentFrame) {
        setMessages(renderState.currentFrame);
      }
    };

    // Watch for changes
    const unwatch = context.watch("currentFrame");
    return () => {
      unwatch();
      context.unsubscribeAll();
    };
  }, [context]);

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{JSON.stringify(msg.message)}</div>
      ))}
    </div>
  );
}
```

## Player API

The Player API defines the interface for data sources.

### Player Interface

```typescript
interface Player {
  /**
   * Set the player state listener
   * @param listener Callback for state updates
   */
  setListener(
    listener: (playerState: PlayerState) => Promise<void>
  ): void;

  /**
   * Close the player and release resources
   */
  close(): void;

  /**
   * Set topic subscriptions
   * @param subscriptions Topic subscription configuration
   */
  setSubscriptions(subscriptions: SubscribePayload[]): void;

  /**
   * Set advertised topics for publishing
   * @param publishers Publisher configuration
   */
  setPublishers(publishers: AdvertiseOptions[]): void;

  /**
   * Publish a message
   * @param request Publish request
   */
  publish(request: PublishPayload): void;

  /**
   * Call a service (optional)
   * @param service Service name
   * @param request Request data
   */
  callService?(service: string, request: unknown): Promise<unknown>;

  /**
   * Seek to a specific time (optional)
   * @param time Target time
   */
  seekPlayback?(time: Time): void;

  /**
   * Set playback speed (optional)
   * @param speed Speed multiplier
   */
  setPlaybackSpeed?(speed: number): void;
}
```

### PlayerState

```typescript
interface PlayerState {
  /** Player presence status */
  presence: PlayerPresence;
  
  /** Loading/processing progress */
  progress?: Progress;
  
  /** Player capabilities */
  capabilities: PlayerCapabilities[];
  
  /** Active data when playing */
  activeData?: PlayerStateActiveData;
}

enum PlayerPresence {
  NOT_PRESENT = "NOT_PRESENT",
  INITIALIZING = "INITIALIZING",
  BUFFERING = "BUFFERING",
  PRESENT = "PRESENT",
  ERROR = "ERROR",
}

enum PlayerCapabilities {
  playbackControl = "playbackControl",
  seekBackwards = "seekBackwards",
  seekForwards = "seekForwards",
  setSpeed = "setSpeed",
  publish = "publish",
  callService = "callService",
  setParameters = "setParameters",
}
```

## Message Types

Common message interfaces used throughout the system.

### MessageEvent

Core message structure.

```typescript
interface MessageEvent {
  /** Topic name */
  topic: string;
  
  /** Message receipt time */
  receiveTime: Time;
  
  /** Message data */
  message: unknown;
  
  /** Message size in bytes */
  sizeInBytes: number;
  
  /** Schema name (optional) */
  schemaName?: string;
}
```

### Time

Timestamp representation.

```typescript
interface Time {
  /** Seconds since epoch */
  sec: number;
  
  /** Nanoseconds since epoch */
  nsec: number;
}

// Utility functions
function toNanoTime(time: Time): bigint;
function fromNanoTime(nanos: bigint): Time;
function compareTime(a: Time, b: Time): number;
```

### Topic

Topic metadata.

```typescript
interface Topic {
  /** Topic name */
  name: string;
  
  /** Message schema name */
  schemaName?: string;
  
  /** Original topic if aliased */
  aliasedFromName?: string;
}
```

## Data Source API

API for implementing custom data sources.

### IDataSourceFactory

Factory interface for creating players.

```typescript
interface IDataSourceFactory {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  displayName: string;
  
  /** Icon name (optional) */
  iconName?: RegisteredIconNames;
  
  /** Source type */
  type: "file" | "connection" | "sample";
  
  /** Supported file extensions */
  supportedFileTypes?: string[];
  
  /**
   * Initialize a player
   * @param args Initialization arguments
   * @returns Player instance
   */
  initialize(
    args: DataSourceFactoryInitializeArgs
  ): Player | Promise<Player>;
}
```

### Implementation Example

```typescript
class MyDataSourceFactory implements IDataSourceFactory {
  id = "my-data-source";
  displayName = "My Data Source";
  type = "file" as const;
  supportedFileTypes = [".mydata"];

  async initialize(args: DataSourceFactoryInitializeArgs): Promise<Player> {
    const { files } = args;
    if (!files || files.length === 0) {
      throw new Error("No file provided");
    }

    return new MyPlayer(files[0]);
  }
}
```

## Layout API

API for managing panel layouts.

### ILayoutManager

Interface for layout persistence.

```typescript
interface ILayoutManager {
  /** Get all saved layouts */
  getLayouts(): Promise<Layout[]>;
  
  /** Save a new layout */
  saveNewLayout(layout: LayoutData): Promise<Layout>;
  
  /** Update existing layout */
  updateLayout(layout: Layout): Promise<Layout>;
  
  /** Delete a layout */
  deleteLayout(id: string): Promise<void>;
  
  /** Import layout from data */
  importLayout(data: LayoutData): Promise<Layout>;
  
  /** Export layout data */
  exportLayout(id: string): Promise<LayoutData>;
}
```

### LayoutData

Layout configuration structure.

```typescript
interface LayoutData {
  /** Panel configurations by ID */
  configById: Record<string, PanelConfig>;
  
  /** Global variables */
  globalVariables: Record<string, unknown>;
  
  /** User script nodes */
  userNodes: Record<string, UserNode>;
  
  /** Playback settings */
  playbackConfig: PlaybackConfig;
  
  /** Panel arrangement */
  layout: MosaicNode<string> | TabPanelConfig;
}
```

## User Script API

API for user scripts that process messages.

### Script Structure

```typescript
// Define input topics
export const inputs = ["/input_topic"];

// Define output topic
export const output = "/output_topic";

// Main processing function
export default function(event: MessageEvent): unknown {
  const { message, topic, receiveTime } = event;
  
  // Process message
  const processed = processMessage(message);
  
  // Return output message
  return {
    header: {
      stamp: receiveTime,
      frame_id: "base_link"
    },
    data: processed
  };
}
```

### Available Globals

User scripts have access to:

- `log`: Logging functions (`log.info()`, `log.warn()`, `log.error()`)
- Standard JavaScript APIs
- Previous message state (maintained between calls)

### Advanced Example

```typescript
// Maintain state between messages
const history: number[] = [];

export const inputs = ["/sensor_reading"];
export const output = "/filtered_reading";

export default function(event: MessageEvent): unknown {
  const value = event.message.value;
  
  // Add to history
  history.push(value);
  if (history.length > 10) {
    history.shift();
  }
  
  // Calculate moving average
  const average = history.reduce((a, b) => a + b, 0) / history.length;
  
  return {
    value: average,
    raw_value: value,
    timestamp: event.receiveTime
  };
}
```

## Event System

Lichtblick uses an event-driven architecture for communication between components.

### Event Types

```typescript
enum LayoutManagerEvent {
  /** Layout list changed */
  "change" = "change",
  
  /** Busy state changed */
  "busychange" = "busychange",
  
  /** Online state changed */
  "onlinechange" = "onlinechange",
  
  /** Error occurred */
  "errorchange" = "errorchange",
}

enum PlayerEvent {
  /** Player state updated */
  "state" = "state",
  
  /** Progress updated */
  "progress" = "progress",
  
  /** Error occurred */
  "error" = "error",
}
```

### Event Handling

```typescript
// Subscribe to events
layoutManager.on("change", (event) => {
  console.log("Layouts changed:", event.layouts);
});

// Unsubscribe
layoutManager.off("change", handler);

// One-time listener
layoutManager.once("change", (event) => {
  console.log("First change:", event);
});
```

## Best Practices

### Performance

1. **Message Processing**
   - Process messages efficiently in panels
   - Use memoization for expensive computations
   - Batch updates to avoid excessive re-renders

2. **Subscriptions**
   - Only subscribe to needed topics
   - Unsubscribe when panel unmounts
   - Use field filters to reduce data transfer

### Error Handling

```typescript
try {
  await context.callService("/my_service", request);
} catch (error) {
  console.error("Service call failed:", error);
  // Show user-friendly error
}
```

### Type Safety

```typescript
// Define message types
interface SensorMessage {
  header: Header;
  temperature: number;
  humidity: number;
}

// Type-safe message handling
context.onRender = (state: RenderState) => {
  const sensorMessages = state.currentFrame
    ?.filter(evt => evt.topic === "/sensors")
    .map(evt => evt.message as SensorMessage);
};
```

---

For more information, see:
- [Architecture Overview](architecture-overview.md)
- [Extension Development Guide](https://docs.lichtblick.dev/extensions)
- [TypeScript API Reference](https://api.lichtblick.dev)