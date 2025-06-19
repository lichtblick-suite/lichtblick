# Developer Guide

This guide is intended for developers who want to contribute to Lichtblick or build on top of it using its extension APIs.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Building and Testing](#building-and-testing)
4. [Creating Extensions](#creating-extensions)
5. [Creating Custom Panels](#creating-custom-panels)
6. [Creating Custom Data Sources](#creating-custom-data-sources)
7. [Contributing Guidelines](#contributing-guidelines)

## Development Setup

### Prerequisites

- Node.js v20 or later
- Yarn (via corepack)
- Git

### Setup Steps

1. Clone the repository:
   ```sh
   git clone https://github.com/lichtblick-suite/lichtblick.git
   cd lichtblick
   ```

2. Enable corepack (for Yarn):
   ```sh
   corepack enable
   ```

3. Install dependencies:
   ```sh
   yarn install
   ```

4. Build packages:
   ```sh
   yarn build:packages
   ```

## Project Structure

The Lichtblick project is organized into the following main directories:

- `/benchmark`: Performance benchmarking tools
- `/ci`: Continuous integration scripts
- `/desktop`: Desktop application (Electron)
- `/packages`: Shared packages and libraries
  - `/packages/suite-base`: Core functionality shared between desktop and web
  - `/packages/suite-desktop`: Desktop-specific functionality
  - `/packages/suite-web`: Web-specific functionality
  - `/packages/den`: Utility libraries
  - `/packages/@types`: TypeScript type definitions
- `/web`: Web application
- `/resources`: Static resources like images

## Building and Testing

### Development Builds

#### Desktop App
```sh
# Terminal 1: Start webpack dev server
yarn desktop:serve

# Terminal 2: Launch Electron
yarn desktop:start
```

#### Web App
```sh
yarn web:serve
# Access at http://localhost:8080
```

### Production Builds

#### Desktop App
```sh
# Build desktop app
yarn desktop:build:prod

# Package for specific platforms
yarn package:win     # Windows
yarn package:darwin  # macOS
yarn package:linux   # Linux
```

#### Web App
```sh
yarn web:build:prod
```

### Running Tests

```sh
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run integration tests
yarn test:integration
```

### Linting

```sh
# Run ESLint
yarn lint

# Check unused exports
yarn lint:unused-exports

# Check dependencies
yarn lint:dependencies
```

## Creating Extensions

Extensions allow you to add new functionality to Lichtblick without modifying the core codebase.

### Extension Structure

A basic extension consists of:

```
my-extension/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── panels/
    └── dataSources/
```

### Extension Entry Point

```typescript
// src/index.ts
import { ExtensionContext } from "@lichtblick/suite-base";

export function activate(context: ExtensionContext): void {
  // Register panels, data sources, or other components
  context.registerPanel({
    title: "My Panel",
    type: "MyCustomPanel",
    module: async () => await import("./panels/MyPanel"),
  });
}

export function deactivate(): void {
  // Clean up any resources
}
```

### Packaging an Extension

1. Build your extension:
   ```sh
   yarn build
   ```

2. Package it as a `.lichtblick-extension` file:
   ```sh
   zip -r my-extension.lichtblick-extension dist package.json
   ```

## Creating Custom Panels

### Basic Panel Structure

```typescript
import React, { useEffect, useState } from "react";
import { PanelExtensionContext, MessageEvent } from "@lichtblick/suite-base";

function MyCustomPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [messages, setMessages] = useState<Record<string, any>>({});
  
  // Set up topic subscriptions
  useEffect(() => {
    const subscriptions = context.topics.map((topic) => {
      return context.dataSource.subscribe(topic, (message: MessageEvent) => {
        setMessages((prev) => ({
          ...prev,
          [topic]: message.message,
        }));
      });
    });
    
    return () => {
      subscriptions.forEach((subscription) => context.dataSource.unsubscribe(subscription));
    };
  }, [context.topics, context.dataSource]);
  
  // Render the panel
  return (
    <div className="my-custom-panel">
      <h2>My Custom Panel</h2>
      <div>
        {Object.entries(messages).map(([topic, message]) => (
          <div key={topic}>
            <h3>{topic}</h3>
            <pre>{JSON.stringify(message, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MyCustomPanel;
```

### Panel Settings

To add settings to your panel:

```typescript
import React from "react";
import { PanelExtensionContext, PanelSettingsProps } from "@lichtblick/suite-base";

function MyPanelSettings({ settings, saveSettings }: PanelSettingsProps): JSX.Element {
  return (
    <div>
      <label>
        Show Raw Data:
        <input
          type="checkbox"
          checked={settings.showRawData ?? true}
          onChange={(e) => saveSettings({ ...settings, showRawData: e.target.checked })}
        />
      </label>
    </div>
  );
}

function MyCustomPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const showRawData = context.settings.showRawData ?? true;
  
  // Panel implementation...
}

export default MyCustomPanel;
export { MyPanelSettings };
```

## Creating Custom Data Sources

### Data Source Factory

```typescript
import { DataSourceFactory, DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base";

class MyDataSourceFactory implements DataSourceFactory {
  id = "my-custom-source";
  displayName = "My Custom Data Source";
  
  async initialize(args: DataSourceFactoryInitializeArgs): Promise<void> {
    // Initialize the factory
  }
  
  async createDataSource({ sourceId, configuration }): Promise<DataSource> {
    return new MyDataSource(sourceId, configuration);
  }
}
```

### Data Source Implementation

```typescript
import { DataSource, Message, Subscription, Topic } from "@lichtblick/suite-base";

class MyDataSource implements DataSource {
  id: string;
  name: string;
  type = "my-custom-source";
  
  private topics: Topic[] = [];
  private subscriptions: Map<string, Set<(msg: Message) => void>> = new Map();
  
  constructor(id: string, configuration: any) {
    this.id = id;
    this.name = configuration.name || "My Data Source";
    // Initialize your data source with configuration
  }
  
  async initialize(): Promise<void> {
    // Connect to your data source
    // Discover topics
    this.topics = [
      { name: "/example_topic", datatype: "std_msgs/String" },
      // Add more topics
    ];
  }
  
  getTopics(): Topic[] {
    return this.topics;
  }
  
  getMessageSchemaByTopic(topic: string): any {
    // Return the message schema for the topic
    return {
      type: "object",
      properties: {
        data: { type: "string" },
      },
    };
  }
  
  subscribe(topic: string, callback: (msg: Message) => void): Subscription {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      // Start listening for messages on this topic
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
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(topic);
        // Stop listening for messages on this topic
      }
    }
  }
  
  close(): void {
    // Clean up resources
    this.subscriptions.clear();
  }
}
```

## Contributing Guidelines

### Code Style

Lichtblick follows a consistent coding style enforced by ESLint and Prettier. To ensure your code meets these standards:

```sh
yarn lint
```

### Commit Messages

Commit messages should follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types include:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Build process or auxiliary tool changes

### Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request to `main`

### Documentation

- All new features should include appropriate documentation
- Update existing documentation when changing behavior

For more detailed information about contributing, please see the [CONTRIBUTING.md](../CONTRIBUTING.md) file.
