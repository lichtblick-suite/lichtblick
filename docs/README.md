# Lichtblick Developer Documentation

Welcome to the Lichtblick developer documentation! This comprehensive guide covers the architecture, APIs, and development workflows for the Lichtblick robotics data visualization platform.

## 📚 Documentation Overview

### Architecture & Design

- **[Architecture Overview](architecture-overview.md)** - Complete system architecture including frontend/backend separation, component organization, and platform-specific implementations
- **[Class Diagrams](class-diagrams.md)** - UML class diagrams showing relationships between core components
- **[Sequence Diagrams](sequence-diagrams.md)** - Detailed workflow diagrams for data loading, extension management, and real-time connections

### Development Guides

- **[API Documentation](api-documentation.md)** - Complete API reference for extension developers and contributors
- **[Use Cases](use-cases.md)** - Step-by-step guides for common workflows and features
- **[Screenshots Guide](screenshots.md)** - Visual reference for UI components and features

## 🏗️ Architecture Highlights

Lichtblick is built with a modular, extensible architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Lichtblick Platform                    │
├─────────────────────┬───────────────────────────────────┤
│   Desktop (Electron) │        Web (Browser)              │
├─────────────────────┴───────────────────────────────────┤
│                Core (@lichtblick/suite-base)             │
├──────────────────────────────────────────────────────────┤
│                    Extension System                       │
├──────────────────────────────────────────────────────────┤
│   Player System  │  Panel System  │  Layout Manager      │
└──────────────────────────────────────────────────────────┘
```

## 🚀 Key Features

### Multi-Platform Support
- **Desktop**: Native Electron application with file system access
- **Web**: Progressive web app with offline capabilities
- **Shared Core**: Common business logic across platforms

### Extensibility
- **Custom Panels**: Create specialized visualizations
- **Message Converters**: Transform between message schemas
- **Topic Aliases**: Compute derived topics
- **Camera Models**: Custom 3D projection models

### Data Source Support
- MCAP files (`.mcap`)
- ROS 1 bag files (`.bag`)
- ROS 2 bag files (`.db3`)
- Foxglove WebSocket connections
- ROSBridge connections
- Custom data sources via extensions

### Rich Visualization
- 3D scene rendering with Three.js
- Time-series plotting
- Image visualization with annotations
- Raw message inspection
- Custom visualizations via extensions

## 🛠️ Development Workflow

### Getting Started

1. **Clone and Install**
   ```bash
   git clone https://github.com/lichtblick-suite/lichtblick.git
   cd lichtblick
   corepack enable
   yarn install
   ```

2. **Development Mode**
   ```bash
   # Desktop development
   yarn desktop:serve  # Start webpack dev server
   yarn desktop:start  # Launch Electron app

   # Web development
   yarn web:serve      # Available at http://localhost:8080
   ```

3. **Build for Production**
   ```bash
   # Desktop builds
   yarn desktop:build:prod
   yarn package:darwin  # macOS
   yarn package:win     # Windows
   yarn package:linux   # Linux

   # Web build
   yarn web:build:prod
   ```

### Extension Development

Create custom functionality by developing extensions:

```typescript
import { ExtensionContext } from "@lichtblick/suite";

export function activate(context: ExtensionContext): void {
  context.registerPanel({
    name: "My Custom Panel",
    component: MyPanelComponent,
  });
}
```

See the [API Documentation](api-documentation.md#extension-api) for complete details.

## 📖 Documentation Structure

### Visual Diagrams

All PlantUML source files are in `docs/puml/`:
- Architecture diagrams
- Class diagrams
- Sequence diagrams

Generated PNG images are in `docs/images/`.

### Regenerating Diagrams

To regenerate diagrams from PlantUML sources:

```bash
cd docs/puml
plantuml -tpng *.puml -o ../images/
```

## 🤝 Contributing

We welcome contributions! Please see:
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) - Community standards

### Documentation Contributions

When updating documentation:
1. Keep diagrams in sync with code changes
2. Update both PlantUML sources and regenerate PNGs
3. Include examples for new APIs
4. Test all code samples

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/lichtblick-suite/lichtblick/issues)
- **Discussions**: [GitHub Discussions](https://github.com/lichtblick-suite/lichtblick/discussions)
- **Official Docs**: [lichtblick-suite.github.io/docs](https://lichtblick-suite.github.io/docs/)

## 📄 License

Lichtblick is licensed under the [Mozilla Public License 2.0](../LICENSE).

---

*This documentation is maintained by the Lichtblick community. Last updated: January 2025*