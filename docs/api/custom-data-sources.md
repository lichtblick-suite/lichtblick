# Creating Custom Data Sources in Lichtblick

This guide explains how to create custom data sources for Lichtblick, allowing you to integrate with your own robotics data formats or sources.

## Data Source Architecture

Data sources in Lichtblick follow a factory pattern:

1. **DataSourceFactory** - Creates and configures data source instances
2. **DataSource** - Provides the interface for accessing data

## Creating a Custom Data Source

### Step 1: Implement the DataSourceFactory Interface

First, create a factory class that implements the `DataSourceFactory` interface:

```typescript
import { 
  DataSourceFactory,
  DataSourceFactoryInitializeArgs,
  DataSource,
} from "@lichtblick/suite-base";

class MyCustomDataSourceFactory implements DataSourceFactory {
  id = "my-custom-source";
  displayName = "My Custom Data Source";
  iconName?: string = "database"; // Optional icon
  
  async initialize(args: DataSourceFactoryInitializeArgs): Promise<void> {
    // One-time initialization (optional)
    // You can initialize SDK clients, check for requirements, etc.
  }
  
  async createDataSource(params: {
    sourceId: string;
    configuration: unknown;
  }): Promise<DataSource> {
    // Create and return a new data source instance
    return new MyCustomDataSource(params.sourceId, params.configuration);
  }
}
```

### Step 2: Implement the DataSource Interface

Next, create your data source class implementing the `DataSource` interface:

```typescript
import {
  DataSource,
  MessageEvent,
  Topic,
  Subscription,
  Time,
  MessageSchema,
  PlaybackState,
} from "@lichtblick/suite-base";

class MyCustomDataSource implements DataSource {
  id: string;
  name: string;
  type = "my-custom-source";
  
  private topics: Topic[] = [];
  private subscriptions: Map<string, Set<(msg: MessageEvent) => void>> = new Map();
  private connected = false;
  
  constructor(id: string, configuration: any) {
    this.id = id;
    this.name = configuration.name || "My Data Source";
    // Store any configuration you need
  }
  
  // Initialize the data source and establish connections
  async initialize(): Promise<void> {
    try {
      // Connect to your data source
      // For example, open a WebSocket, connect to a database, etc.
      
      // Discover available topics
      this.topics = await this.fetchTopics();
      
      this.connected = true;
    } catch (error) {
      console.error("Failed to initialize data source:", error);
      throw error;
    }
  }
  
  // Get the list of available topics
  getTopics(): Topic[] {
    return this.topics;
  }
  
  // Get the schema for a specific topic
  getMessageSchemaByTopic(topic: string): MessageSchema | undefined {
    // Return the schema definition for this topic if available
    return this.getSchema(topic);
  }
  
  // Subscribe to a topic
  subscribe(topic: string, callback: (msg: MessageEvent) => void): Subscription {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      
      // Start fetching data for this topic if not already doing so
      this.startSubscription(topic);
    }
    
    const callbacks = this.subscriptions.get(topic)!;
    callbacks.add(callback);
    
    return {
      topic,
      callback,
    };
  }
  
  // Unsubscribe from a topic
  unsubscribe(subscription: Subscription): void {
    const { topic, callback } = subscription;
    const callbacks = this.subscriptions.get(topic);
    
    if (!callbacks) {
      return;
    }
    
    callbacks.delete(callback);
    
    if (callbacks.size === 0) {
      this.subscriptions.delete(topic);
      
      // Stop fetching data for this topic
      this.stopSubscription(topic);
    }
  }
  
  // Close the data source and clean up
  close(): void {
    // Close any connections and clean up resources
    
    this.subscriptions.clear();
    this.connected = false;
  }
  
  // For recorded/playable data sources, implement these methods
  
  getStart(): Time {
    // Return the start time of the data
    return { sec: 0, nsec: 0 };
  }
  
  getEnd(): Time {
    // Return the end time of the data
    return { sec: 0, nsec: 0 };
  }
  
  getMessageCount(topic: string): number {
    // Return the number of messages for the topic
    return 0;
  }
  
  async seekPlayback(time: Time): Promise<void> {
    // Move playhead to the specified time
  }
  
  playbackState(): PlaybackState {
    // Return current playback state
    return {
      isPlaying: false,
      speed: 1.0,
      repeatEnabled: false,
    };
  }
  
  // Private helper methods
  
  private async fetchTopics(): Promise<Topic[]> {
    // Fetch and return the list of available topics
    // Each topic should have a name and datatype
    return [
      { name: "/example_topic", datatype: "std_msgs/String" },
      // Add more topics as needed
    ];
  }
  
  private getSchema(topic: string): MessageSchema | undefined {
    // Return the message schema for the topic
    // This helps panels understand the structure of messages
    
    if (topic === "/example_topic") {
      return {
        type: "object",
        properties: {
          data: { type: "string" },
        },
      };
    }
    
    return undefined;
  }
  
  private startSubscription(topic: string): void {
    // Start receiving data for the topic
    // For example, set up a timer to fetch data or listen for events
    
    // When you receive a message, notify all subscribers:
    const onMessage = (data: any) => {
      const callbacks = this.subscriptions.get(topic);
      if (!callbacks) {
        return;
      }
      
      const messageEvent: MessageEvent = {
        topic,
        receiveTime: { sec: Math.floor(Date.now() / 1000), nsec: 0 },
        message: data,
        schemaName: this.getTopicDataType(topic),
      };
      
      callbacks.forEach((callback) => callback(messageEvent));
    };
    
    // Store the subscription handler to clean up later
  }
  
  private stopSubscription(topic: string): void {
    // Stop receiving data for the topic
    // Clean up any timers or event listeners
  }
  
  private getTopicDataType(topic: string): string {
    // Return the data type for the topic
    const foundTopic = this.topics.find((t) => t.name === topic);
    return foundTopic?.datatype || "unknown";
  }
}
```

### Step 3: Create a Configuration Component (Optional)

For user-configurable data sources, create a React component for configuration:

```tsx
import React, { useState } from "react";
import { DataSourceConfigProps } from "@lichtblick/suite-base";

function MyCustomSourceConfig(props: DataSourceConfigProps): JSX.Element {
  const { config, onChange } = props;
  const [url, setUrl] = useState(config.url || "");
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    onChange({ ...config, url: newUrl });
  };
  
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    onChange({ ...config, apiKey: newApiKey });
  };
  
  return (
    <div>
      <div className="form-group">
        <label htmlFor="url">Server URL</label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="https://example.com/api"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="apiKey">API Key</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={handleApiKeyChange}
          placeholder="Enter API key"
        />
      </div>
    </div>
  );
}

export default MyCustomSourceConfig;
```

### Step 4: Register Your Data Source Factory

Register your data source factory with Lichtblick:

```typescript
import { registerDataSourceFactory } from "@lichtblick/suite-base";
import MyCustomDataSourceFactory from "./MyCustomDataSourceFactory";
import MyCustomSourceConfig from "./MyCustomSourceConfig";

// Register with configuration UI component
registerDataSourceFactory({
  factory: new MyCustomDataSourceFactory(),
  configComponent: MyCustomSourceConfig,
});
```

## Handling Different Data Types

### Time-Series Data

For time-series data:

```typescript
private startSubscription(topic: string): void {
  // Example: Fetch time-series data from an API
  const fetchInterval = setInterval(async () => {
    try {
      const response = await fetch(`${this.apiUrl}/data/${topic}`);
      const data = await response.json();
      
      const callbacks = this.subscriptions.get(topic);
      if (!callbacks) {
        return;
      }
      
      data.forEach((point) => {
        const messageEvent: MessageEvent = {
          topic,
          receiveTime: { sec: Math.floor(point.timestamp / 1000), nsec: (point.timestamp % 1000) * 1000000 },
          message: {
            value: point.value,
            status: point.status,
          },
          schemaName: "custom/TimeSeries",
        };
        
        callbacks.forEach((callback) => callback(messageEvent));
      });
    } catch (error) {
      console.error(`Error fetching data for ${topic}:`, error);
    }
  }, 1000); // Fetch every second
  
  this.activeSubscriptions.set(topic, fetchInterval);
}
```

### File-Based Data

For file-based data sources:

```typescript
async initialize(): Promise<void> {
  try {
    const { filePath } = this.configuration;
    
    // Open and parse the file
    const fileData = await readFile(filePath);
    this.data = parseFileData(fileData);
    
    // Extract topics from the file data
    this.topics = this.extractTopics();
    
    this.connected = true;
  } catch (error) {
    console.error("Failed to initialize file-based data source:", error);
    throw error;
  }
}

// Example implementation for a file-based data source
private startPlayback(): void {
  if (this.isPlaying) {
    return;
  }
  
  this.isPlaying = true;
  this.playbackInterval = setInterval(() => {
    const currentTime = this.currentPlaybackTime;
    
    // Find messages at the current time
    for (const topic of this.subscriptions.keys()) {
      const messages = this.getMessagesAt(topic, currentTime);
      const callbacks = this.subscriptions.get(topic);
      
      if (!callbacks) {
        continue;
      }
      
      // Notify subscribers
      for (const message of messages) {
        const event: MessageEvent = {
          topic,
          receiveTime: currentTime,
          message,
          schemaName: this.getTopicDataType(topic),
        };
        
        callbacks.forEach((callback) => callback(event));
      }
    }
    
    // Advance playback time
    this.advancePlaybackTime();
    
    // Check if we've reached the end
    if (this.currentPlaybackTime.sec > this.endTime.sec) {
      if (this.repeatEnabled) {
        this.seekPlayback(this.startTime);
      } else {
        this.pausePlayback();
      }
    }
  }, 100); // Update at 10 Hz
}
```

### Streaming Data

For streaming data sources like WebSockets:

```typescript
async initialize(): Promise<void> {
  try {
    const { url } = this.configuration;
    
    // Connect WebSocket
    this.socket = new WebSocket(url);
    
    this.socket.addEventListener("open", () => {
      this.connected = true;
      this.emit("connection_changed", true);
    });
    
    this.socket.addEventListener("close", () => {
      this.connected = false;
      this.emit("connection_changed", false);
    });
    
    this.socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle incoming messages
        if (data.type === "topic_list") {
          // Update available topics
          this.topics = data.topics.map((t) => ({
            name: t.name,
            datatype: t.datatype,
          }));
          
          this.emit("topics_changed");
        } else if (data.type === "message") {
          // Handle message from subscribed topic
          const { topic, message, timestamp } = data;
          
          const callbacks = this.subscriptions.get(topic);
          if (!callbacks) {
            return;
          }
          
          const messageEvent: MessageEvent = {
            topic,
            receiveTime: { sec: Math.floor(timestamp / 1000), nsec: (timestamp % 1000) * 1000000 },
            message,
            schemaName: this.getTopicDataType(topic),
          };
          
          callbacks.forEach((callback) => callback(messageEvent));
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    });
    
    // Request topic list
    this.socket.send(JSON.stringify({ op: "get_topics" }));
  } catch (error) {
    console.error("Failed to initialize WebSocket data source:", error);
    throw error;
  }
}

subscribe(topic: string, callback: (msg: MessageEvent) => void): Subscription {
  if (!this.subscriptions.has(topic)) {
    this.subscriptions.set(topic, new Set());
    
    // Subscribe to the topic on the WebSocket
    if (this.connected && this.socket) {
      this.socket.send(JSON.stringify({
        op: "subscribe",
        topic,
      }));
    }
  }
  
  const callbacks = this.subscriptions.get(topic)!;
  callbacks.add(callback);
  
  return {
    topic,
    callback,
  };
}

unsubscribe(subscription: Subscription): void {
  const { topic, callback } = subscription;
  const callbacks = this.subscriptions.get(topic);
  
  if (!callbacks) {
    return;
  }
  
  callbacks.delete(callback);
  
  if (callbacks.size === 0) {
    this.subscriptions.delete(topic);
    
    // Unsubscribe from the topic on the WebSocket
    if (this.connected && this.socket) {
      this.socket.send(JSON.stringify({
        op: "unsubscribe",
        topic,
      }));
    }
  }
}
```

## Best Practices

### Error Handling

Implement robust error handling:

```typescript
async initialize(): Promise<void> {
  try {
    // Initialization code
  } catch (error) {
    console.error("Data source initialization error:", error);
    
    // Provide detailed error information
    throw new Error(`Failed to initialize data source: ${error.message}`);
  }
}
```

### Connection Management

Handle connection state changes:

```typescript
class MyCustomDataSource extends EventEmitter implements DataSource {
  // ...
  
  private handleConnectionChange(connected: boolean): void {
    this.connected = connected;
    
    // Notify listeners about connection state change
    this.emit("connection_changed", connected);
    
    if (connected) {
      // Re-subscribe to topics after reconnection
      for (const topic of this.subscriptions.keys()) {
        this.startSubscription(topic);
      }
    }
  }
}
```

### Performance Optimization

Optimize for performance:

```typescript
// Use efficient data structures
private messageCache = new Map<string, CircularBuffer<MessageEvent>>();

// Implement throttling for high-frequency topics
private startSubscription(topic: string): void {
  // For high-frequency topics, consider throttling
  if (this.isHighFrequencyTopic(topic)) {
    this.startThrottledSubscription(topic);
  } else {
    this.startNormalSubscription(topic);
  }
}

private startThrottledSubscription(topic: string): void {
  let lastPublishTime = 0;
  const throttleMs = 100; // Publish at most every 100ms
  
  // Set up the actual subscription
  // When receiving messages:
  const onMessage = (data: any) => {
    // Always cache the message
    this.cacheMessage(topic, data);
    
    // But only notify subscribers at a throttled rate
    const now = Date.now();
    if (now - lastPublishTime >= throttleMs) {
      lastPublishTime = now;
      this.notifySubscribers(topic, data);
    }
  };
}
```

## Testing Your Data Source

Test your data source with unit tests:

```typescript
import MyCustomDataSource from "./MyCustomDataSource";

describe("MyCustomDataSource", () => {
  let dataSource: MyCustomDataSource;
  
  beforeEach(() => {
    dataSource = new MyCustomDataSource("test-source", { url: "test-url" });
  });
  
  afterEach(() => {
    dataSource.close();
  });
  
  test("initializes and provides topics", async () => {
    // Mock any external dependencies
    
    await dataSource.initialize();
    const topics = dataSource.getTopics();
    
    expect(topics).toHaveLength(3); // Or whatever you expect
    expect(topics[0].name).toBe("/example_topic");
  });
  
  test("handles subscriptions", async () => {
    await dataSource.initialize();
    
    const mockCallback = jest.fn();
    const subscription = dataSource.subscribe("/example_topic", mockCallback);
    
    // Trigger a mock message
    // Verify the callback was called
    expect(mockCallback).toHaveBeenCalled();
    
    // Test unsubscribe
    dataSource.unsubscribe(subscription);
    
    // Trigger another message
    // Verify the callback is not called again
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});
```

## Publishing Your Data Source

To publish your data source as an extension:

1. Create an extension manifest
2. Bundle your data source code
3. Register your data source factory in the extension's activate function
4. Package the extension according to Lichtblick's extension format

For more information on creating extensions, see the [Extensions API](./index.md#extensions-api) documentation.
