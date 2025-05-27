# Lichtblick Features

This document provides an overview of the key features of Lichtblick.

## Data Source Support

Lichtblick supports a wide variety of data sources for robotics visualization:

### File-Based

- **ROS1 Bag Files (.bag)**: Load and visualize recorded ROS1 bag files
- **ROS2 Bag Files**: Load and visualize recorded ROS2 bag files
- **MCAP Files (.mcap)**: Support for the modern MCAP file format, which provides efficient storage of robotics data
- **ULog Files**: Support for PX4 flight log files

### Live Connections

- **ROS1 Socket**: Direct connection to a ROS1 master
- **Rosbridge WebSocket**: Connection to a ROS system through the Rosbridge WebSocket protocol
- **Foxglove WebSocket**: Connection using the Foxglove WebSocket protocol

## Visualization Panels

Lichtblick provides a comprehensive set of visualization panels:

### 3D Visualization

- **3D Viewer**: Visualize 3D data such as point clouds, meshes, trajectories, and coordinate frames
- **Map**: 2D map visualization with support for occupancy grids and path planning

### Data Visualization

- **Plot**: Line charts, scatter plots, and other visualizations for numerical data
- **Image**: Display camera images and other visual data
- **Gauge**: Display numerical values in gauge format
- **Indicator**: Visual indicators for state information
- **Table**: Display tabular data
- **Raw Messages**: View the raw message data as JSON

### Diagnostics and Debugging

- **Log**: View ROS log messages
- **Diagnostic Status**: Detailed view of ROS diagnostics messages
- **Diagnostic Summary**: Overview of system health based on diagnostics
- **Parameters**: View and edit ROS parameters
- **State Transitions**: Visualize state machine transitions over time
- **Topic Graph**: Visualize the structure of ROS topics, nodes, and their connections

### Interaction

- **Publish**: Publish messages to ROS topics
- **Call Service**: Make calls to ROS services
- **Teleop**: Teleoperation controls for robots

## Layout Management

- **Custom Layouts**: Create, save, and switch between different visualization layouts
- **Flexible Panel Arrangement**: Resize, move, and rearrange panels to create your ideal workspace
- **Layout Import/Export**: Share layouts between users or devices
- **Persistent Layouts**: Layouts are automatically saved and restored

## Advanced Features

- **Time Synchronization**: All panels are synchronized to the same time, allowing for cohesive visualization of data
- **Variable System**: Define global variables that can be used across panels
- **User Scripts**: Write custom JavaScript/TypeScript to process and transform data
- **Extensions**: Extend functionality with custom extensions

## UI Features

- **Dark/Light Mode**: Choose between dark and light UI themes
- **Responsive Design**: Works across different screen sizes
- **Panel Search**: Quickly find the panel you need
- **Keyboard Shortcuts**: Improve workflow efficiency with keyboard shortcuts
- **Panel Settings**: Each panel has specific settings for customization
- **Color Customization**: Customize the colors used in visualizations

## Platform Support

- **Desktop Application**: Native applications for Windows, macOS, and Linux
- **Web Application**: Use in any modern web browser without installation
- **Cross-Platform**: Consistent experience across platforms
