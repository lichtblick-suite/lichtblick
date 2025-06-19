# Creating Custom Panels in Lichtblick

This guide will walk you through the process of creating a custom visualization panel for Lichtblick.

## Panel Architecture

Panels in Lichtblick are React components that follow a specific API to interact with the application. Each panel can:

- Subscribe to data from various topics
- Configure its own settings
- Persist its configuration
- Render visualizations based on the data it receives

## Basic Panel Structure

A basic panel consists of the following components:

1. **Panel Component** - The main React component that renders the panel
2. **Panel Settings** - A React component that renders the settings UI
3. **Panel Config** - The configuration data structure for the panel

## Creating a Custom Panel

### 1. Define the Panel Component

First, create your panel component:

```tsx
import React, { useEffect, useState } from "react";
import { PanelExtensionContext, MessageEvent } from "@lichtblick/suite-base";

function MyCustomPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [messages, setMessages] = useState<Record<string, any>>({});
  
  // Access settings
  const { showLabels = true, lineColor = "#ff0000" } = context.panelConfig;
  
  // Set up topic subscriptions
  useEffect(() => {
    // Get selected topics from the context
    const selectedTopics = context.topics || [];
    
    // Subscribe to each selected topic
    const subscriptions = selectedTopics.map((topic) => {
      return context.dataSource.subscribe(topic, (message: MessageEvent) => {
        setMessages((prev) => ({
          ...prev,
          [topic]: message.message,
        }));
      });
    });
    
    // Clean up subscriptions when component unmounts
    return () => {
      subscriptions.forEach((subscription) => context.dataSource.unsubscribe(subscription));
    };
  }, [context.topics, context.dataSource]);
  
  // Render the panel
  return (
    <div className="my-custom-panel">
      <h2>My Custom Panel</h2>
      {Object.entries(messages).map(([topic, message]) => (
        <div key={topic} style={{ color: lineColor }}>
          {showLabels && <h3>{topic}</h3>}
          <pre>{JSON.stringify(message, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

export default MyCustomPanel;
```

### 2. Define the Panel Settings Component

Next, create a settings component for your panel:

```tsx
import React from "react";
import { PanelExtensionContext, PanelSettingsProps } from "@lichtblick/suite-base";

function MyPanelSettings({ context }: { context: PanelExtensionContext }): JSX.Element {
  const { panelConfig, saveConfig } = context;
  const { showLabels = true, lineColor = "#ff0000" } = panelConfig;

  return (
    <div>
      <div className="setting-row">
        <label>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => saveConfig({ ...panelConfig, showLabels: e.target.checked })}
          />
          Show Topic Labels
        </label>
      </div>
      
      <div className="setting-row">
        <label>
          Line Color:
          <input
            type="color"
            value={lineColor}
            onChange={(e) => saveConfig({ ...panelConfig, lineColor: e.target.value })}
          />
        </label>
      </div>
      
      <div className="setting-row">
        <h3>Topics</h3>
        <TopicSelector context={context} />
      </div>
    </div>
  );
}

// Reusable component for selecting topics
function TopicSelector({ context }: { context: PanelExtensionContext }): JSX.Element {
  const { panelConfig, saveConfig, dataSource } = context;
  const { topics = [] } = panelConfig;
  const availableTopics = dataSource.getTopics() || [];
  
  const toggleTopic = (topicName: string) => {
    const newTopics = topics.includes(topicName)
      ? topics.filter(t => t !== topicName)
      : [...topics, topicName];
    
    saveConfig({ ...panelConfig, topics: newTopics });
  };
  
  return (
    <div className="topic-selector">
      {availableTopics.map((topic) => (
        <div key={topic.name}>
          <label>
            <input
              type="checkbox"
              checked={topics.includes(topic.name)}
              onChange={() => toggleTopic(topic.name)}
            />
            {topic.name}
          </label>
        </div>
      ))}
    </div>
  );
}

export { MyPanelSettings };
```

### 3. Register Your Panel

To make your panel available in Lichtblick, you need to register it:

```tsx
import { PanelExtensionInfo } from "@lichtblick/suite-base";
import MyCustomPanel, { MyPanelSettings } from "./MyCustomPanel";

const panelInfo: PanelExtensionInfo = {
  id: "my-custom-panel",
  name: "My Custom Panel",
  description: "A custom panel for visualizing data",
  thumbnail: "/path/to/thumbnail.png", // Optional thumbnail image
  component: MyCustomPanel,
  settingsComponent: MyPanelSettings,
  defaultConfig: {
    showLabels: true,
    lineColor: "#ff0000",
    topics: []
  }
};

export default panelInfo;
```

### 4. Using Panel Extension Context

The `PanelExtensionContext` provides access to:

- **panelConfig**: The current panel configuration
- **saveConfig**: Function to save configuration changes
- **dataSource**: Access to the current data source
- **topics**: Selected topics for the panel
- **setRenderState**: Function to update panel render state
- **variables**: Access to global variables
- **colorScheme**: Current application color scheme (light/dark)

## Advanced Panel Features

### 1. Handling Time-Series Data

For panels that visualize time-series data:

```tsx
function TimeSeriesPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [seriesData, setSeriesData] = useState<Record<string, any[]>>({});
  const { maxPoints = 100 } = context.panelConfig;
  
  useEffect(() => {
    const subscriptions = context.topics.map((topic) => {
      return context.dataSource.subscribe(topic, (event) => {
        const { message, receiveTime } = event;
        
        setSeriesData((prev) => {
          const topicData = prev[topic] || [];
          const newData = [
            ...topicData,
            { x: receiveTime, y: message.value }
          ];
          
          // Keep only the latest maxPoints
          const trimmedData = newData.slice(-maxPoints);
          
          return {
            ...prev,
            [topic]: trimmedData
          };
        });
      });
    });
    
    return () => {
      subscriptions.forEach((sub) => context.dataSource.unsubscribe(sub));
    };
  }, [context.topics, maxPoints]);
  
  // Render time-series chart
  return (
    <div>
      <TimeSeriesChart data={seriesData} />
    </div>
  );
}
```

### 2. Implementing Interactivity

Adding interactive elements like selection or zooming:

```tsx
function InteractivePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [selection, setSelection] = useState(null);
  
  const handleClick = (item) => {
    setSelection(item);
    // Update other panels or trigger actions
    context.setGlobalVariable("selectedItem", item);
  };
  
  return (
    <div>
      <InteractiveVisualization
        data={data}
        onClick={handleClick}
        selection={selection}
      />
    </div>
  );
}
```

### 3. Supporting Message Path Syntax

Support for Lichtblick's message path syntax allows users to select specific fields:

```tsx
import { parseMessagePath } from "@lichtblick/message-path";

function MessagePathPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const { path = "" } = context.panelConfig;
  const [value, setValue] = useState<any>(null);
  
  useEffect(() => {
    if (!path) {
      return;
    }
    
    const messagePath = parseMessagePath(path);
    const topic = messagePath.getTopicName();
    
    const subscription = context.dataSource.subscribe(topic, (event) => {
      // Extract the specific field using message path
      const fieldValue = messagePath.getField(event.message);
      setValue(fieldValue);
    });
    
    return () => context.dataSource.unsubscribe(subscription);
  }, [path]);
  
  return (
    <div>
      <h3>Path: {path}</h3>
      <div>Value: {JSON.stringify(value)}</div>
    </div>
  );
}
```

## Best Practices for Panel Development

1. **Responsive Design**: Ensure your panel works well at different sizes
2. **Performance**: Optimize rendering and state updates for large data sets
3. **Error Handling**: Gracefully handle missing data or errors
4. **Consistent Style**: Follow Lichtblick's UI patterns
5. **Accessibility**: Support keyboard navigation and screen readers
6. **State Management**: Keep panel state minimal and focused

## Testing Your Panel

You can test your panel using Jest and React Testing Library:

```tsx
import { render, screen } from "@testing-library/react";
import MyCustomPanel from "./MyCustomPanel";

describe("MyCustomPanel", () => {
  it("renders correctly with default settings", () => {
    const mockContext = {
      panelConfig: {},
      topics: [],
      dataSource: {
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      },
    };
    
    render(<MyCustomPanel context={mockContext} />);
    expect(screen.getByText("My Custom Panel")).toBeInTheDocument();
  });
  
  // Add more tests
});
```

## Packaging Your Panel as an Extension

1. Create an extension manifest
2. Bundle your panel code
3. Register your panel in the extension's activate function
4. Package the extension according to Lichtblick's extension format

For more information on creating extensions, see the [Extensions API](./api/index.md#extensions-api) documentation.
