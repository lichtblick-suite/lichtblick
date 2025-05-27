# Getting Started with Lichtblick

This guide will help you set up and start using Lichtblick for your robotics visualization needs.

## Installation

Lichtblick is available as both a desktop application and a web application.

### Desktop Application

You can download pre-built binaries for your platform:

- **Windows**: Download the latest `.exe` installer from the [releases page](https://github.com/lichtblick-suite/lichtblick/releases)
- **macOS**: Download the latest `.dmg` file from the [releases page](https://github.com/lichtblick-suite/lichtblick/releases)
- **Linux**: Download the latest `.AppImage` or `.deb` package from the [releases page](https://github.com/lichtblick-suite/lichtblick/releases)

### Web Application

The web version of Lichtblick can be accessed at [https://lichtblick-suite.github.io](https://lichtblick-suite.github.io).

## Building from Source

If you prefer to build from source, follow these steps:

1. Prerequisites:
   - Node.js v20 or later
   - Yarn (via corepack)

2. Clone the repository:
   ```sh
   git clone https://github.com/lichtblick-suite/lichtblick.git
   cd lichtblick
   ```

3. Enable corepack:
   ```sh
   corepack enable
   ```

4. Install dependencies:
   ```sh
   yarn install
   ```

5. Launch the development environment:
   ```sh
   # For desktop app:
   yarn desktop:serve       # Start webpack dev server
   yarn desktop:start       # Launch electron (in another terminal)

   # For web app:
   yarn web:serve          # Available at http://localhost:8080
   ```

## Basic Usage

### Opening a Data Source

1. Launch Lichtblick
2. Click on the "Open Data Source" button in the top left corner
3. Select from the available data source types:
   - Local ROS1 Bag (.bag)
   - Local ROS2 Bag
   - Local MCAP File (.mcap)
   - ROS1 Socket
   - Rosbridge WebSocket
   - Foxglove WebSocket
   - ULog File

### Working with Layouts

Lichtblick uses layouts to organize visualization panels. 

1. To create a new layout, click the "Layout" button in the top bar and select "Create New Layout"
2. To add panels to your layout:
   - Click the "Add Panel" button (+ icon)
   - Select a panel type from the menu
   - Configure the panel as needed

3. To save a layout:
   - Click the "Layout" button
   - Select "Save Layout" or "Save Layout As..."

### Connecting to Data

1. In each panel, you can connect to specific topics:
   - Click on the settings (gear) icon in the panel
   - Select the topics you want to visualize
   - Configure any additional panel-specific settings

## Next Steps

- Explore the [Features](./features.md) documentation to learn about all the capabilities of Lichtblick
- Check out the [User Guide](./user-guide.md) for detailed instructions on using specific panels
- Visit the [API Documentation](./api/index.md) if you're a developer looking to integrate with Lichtblick
