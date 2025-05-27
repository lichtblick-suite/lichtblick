# Lichtblick API Documentation

This document provides detailed API documentation for developers working with Lichtblick.

## Table of Contents

1. [Data Source API](#data-source-api)
2. [Panel API](#panel-api)
3. [Layout API](#layout-api)
4. [Extensions API](#extensions-api)
5. [Message Path API](#message-path-api)

## Detailed Guides

- [Creating Custom Panels](./custom-panels.md)
- [Creating Custom Data Sources](./custom-data-sources.md)

## Data Source API

The Data Source API allows you to create custom data sources for Lichtblick.

### DataSourceFactory Interface

To create a custom data source, you need to implement the `DataSourceFactory` interface:

```typescript
interface DataSourceFactory {
  id: string;
  displayName: string;
  iconName?: string;
  
  initialize(params: DataSourceFactoryInitializeArgs): Promise<void>;
  
  createDataSource(params: {
    sourceId: string;
    configuration: unknown;
  }): Promise<DataSource>;
}
```

### DataSource Interface

The `DataSource` interface represents a connection to a data source:

```typescript
interface DataSource {
  id: string;
  name: string;
  type: string;
  
  // Connection management
  initialize(): Promise<void>;
  close(): void;
  
  // Topics and schemas
  getTopics(): Topic[];
  getMessageSchemaByTopic(topic: string): MessageSchema | undefined;
  
  // Message subscription
  subscribe(topic: string, callback: (msg: Message) => void): Subscription;
  unsubscribe(subscription: Subscription): void;
  
  // For recorded data sources
  getStart(): Time;
  getEnd(): Time;
  getMessageCount(topic: string): number;
  seekPlayback(time: Time): Promise<void>;
  playbackState(): PlaybackState;
}
```

### Example Custom Data Source

```typescript
import { DataSourceFactory, DataSource } from "@lichtblick/suite-base";

class MyCustomDataSourceFactory implements DataSourceFactory {
  id = "my-custom-source";
  displayName = "My Custom Source";
  
  async initialize(): Promise<void> {
    // Initialize any resources needed by your data source
  }
  
  async createDataSource({ sourceId, configuration }): Promise<DataSource> {
    return new MyCustomDataSource(sourceId, configuration);
  }
}

class MyCustomDataSource implements DataSource {
  // Implementation details...
}

// Register the factory
registerDataSourceFactory(new MyCustomDataSourceFactory());
```

## Panel API

The Panel API allows you to create custom visualization panels.

### PanelConfig Interface

```typescript
interface PanelConfig {
  id: string;
  title: string;
  type: string;
  config: Record<string, unknown>;
}
```

### PanelComponent Interface

To create a custom panel, implement the `PanelComponent` interface:

```typescript
interface PanelComponent {
  panelState: PanelState;
  
  initialize(): Promise<void>;
  renderPanel(): JSX.Element;
  
  onMessage(topic: string, message: Message): void;
  onLayoutChange(layout: PanelLayout): void;
  onSettingsChange(settings: PanelSettings): void;
  
  save(): PanelConfig;
  restore(config: PanelConfig): void;
}
```

### Example Custom Panel

```typescript
import { PanelComponent, PanelState } from "@lichtblick/suite-base";
import React, { useEffect, useState } from "react";

function MyCustomPanel(props: { panelState: PanelState }): JSX.Element {
  const { panelState } = props;
  const [data, setData] = useState<Record<string, any>>({});
  
  useEffect(() => {
    // Subscribe to topics
    const subscriptions = panelState.topics.map((topic) => {
      return panelState.dataSource.subscribe(topic, (message) => {
        setData((prev) => ({ ...prev, [topic]: message }));
      });
    });
    
    return () => {
      // Cleanup subscriptions
      subscriptions.forEach((sub) => panelState.dataSource.unsubscribe(sub));
    };
  }, [panelState.topics, panelState.dataSource]);
  
  return (
    <div className="my-custom-panel">
      <h3>My Custom Panel</h3>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// Register the panel
registerPanel({
  title: "My Custom Panel",
  type: "MyCustomPanel",
  description: "A custom panel for Lichtblick",
  module: async () => ({ default: MyCustomPanel }),
});
```

## Layout API

The Layout API allows you to manage panel layouts.

### Layout Interface

```typescript
interface Layout {
  id: string;
  name: string;
  modified?: boolean;
  sourceId?: string;
  
  sections: Section[];
  panels: Record<string, PanelConfig>;
  globalVariables?: Record<string, unknown>;
}

interface Section {
  id: string;
  direction: "row" | "column";
  firstSize?: number;
  secondSize?: number;
  
  firstSectionId?: string;
  secondSectionId?: string;
  panelId?: string;
}
```

### LayoutManager Interface

```typescript
interface LayoutManager {
  getCurrentLayout(): Layout;
  getLayouts(): Layout[];
  
  saveNewLayout(name: string): Promise<string>;
  updateLayout(layout: Layout): Promise<void>;
  deleteLayout(id: string): Promise<void>;
  setCurrentLayout(id: string): Promise<void>;
  
  getLayout(id: string): Layout | undefined;
}
```

### Example Layout Management

```typescript
import { useLayoutManager } from "@lichtblick/suite-base";

function LayoutControls(): JSX.Element {
  const layoutManager = useLayoutManager();
  const layouts = layoutManager.getLayouts();
  const currentLayout = layoutManager.getCurrentLayout();
  
  const createNewLayout = async () => {
    const newLayoutId = await layoutManager.saveNewLayout("New Layout");
    await layoutManager.setCurrentLayout(newLayoutId);
  };
  
  const switchLayout = async (id: string) => {
    await layoutManager.setCurrentLayout(id);
  };
  
  // Render your component...
}
```

## Extensions API

The Extensions API allows you to create, install, and manage extensions.

### Extension Interface

```typescript
interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
  
  activate(api: ExtensionAPI): Promise<void>;
  deactivate(): Promise<void>;
}

interface ExtensionAPI {
  registerDataSourceFactory(factory: DataSourceFactory): void;
  registerPanelType(panel: PanelInfo): void;
  
  getTopics(): Topic[];
  subscribe(topic: string, callback: (msg: Message) => void): Subscription;
  unsubscribe(subscription: Subscription): void;
}
```

### Example Extension

```typescript
import { Extension, ExtensionAPI } from "@lichtblick/suite-base";

class MyExtension implements Extension {
  id = "my-extension";
  name = "My Extension";
  version = "1.0.0";
  description = "A custom extension for Lichtblick";
  
  async activate(api: ExtensionAPI): Promise<void> {
    // Register custom panels and data sources
    api.registerPanelType({
      title: "My Panel",
      type: "MyPanel",
      module: async () => await import("./MyPanel"),
    });
    
    api.registerDataSourceFactory(new MyDataSourceFactory());
  }
  
  async deactivate(): Promise<void> {
    // Cleanup resources
  }
}
```

## Message Path API

The Message Path API allows you to work with message paths, which are used to access fields within messages.

### Message Path Syntax

The message path syntax follows this pattern:

- Simple field access: `topic.field.nested_field`
- Array indexing: `topic.array[0].field`
- Slicing: `topic.array[0:10].field`
- Filtering: `topic.array[?field==value].other_field`

### MessagePath Interface

```typescript
interface MessagePath {
  getTopicName(): string;
  getMessagePathParts(): PathPart[];
  getField(message: Message): unknown;
}

type PathPart = 
  | { type: "field"; name: string }
  | { type: "index"; index: number }
  | { type: "slice"; start: number; end: number }
  | { type: "filter"; field: string; value: any };
```

### Example Message Path Usage

```typescript
import { parseMessagePath } from "@lichtblick/message-path";

// Parse a message path
const path = parseMessagePath("/topic.array[0].field");

// Get the topic name
const topicName = path.getTopicName(); // "/topic"

// Get the field from a message
const value = path.getField(message);
```

## Further Resources

- For more information, please refer to the TypeScript type definitions in the `/packages/@types` directory
- Example extensions are available in the extensions documentation
