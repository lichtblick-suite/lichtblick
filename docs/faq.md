# Frequently Asked Questions (FAQ)

This document addresses common questions about Lichtblick.

## General Questions

### What is Lichtblick?

Lichtblick is an integrated visualization and diagnosis tool for robotics, available in your browser or as a desktop app on Linux, Windows, and macOS. It allows you to visualize and analyze robotics data from various sources.

### What platforms are supported?

Lichtblick is available as:
- Desktop application: Windows, macOS, and Linux
- Web application: Any modern web browser

### Is Lichtblick free to use?

Yes, Lichtblick follows an open core licensing model. Most functionality is available under the Mozilla Public License v2.0 (MPL-2.0).

### Who maintains Lichtblick?

Lichtblick is maintained by BMW Group and the open-source community.

## Data Sources

### Which data formats does Lichtblick support?

Lichtblick supports:
- ROS1 bag files (.bag)
- ROS2 bag files
- MCAP files (.mcap)
- ULog files
- Live connections to ROS1 and ROS2 systems
- Rosbridge WebSocket
- Foxglove WebSocket

### Can I connect to a running ROS system?

Yes, you can connect to running ROS systems using:
- Direct ROS1 Socket connection
- Rosbridge WebSocket
- Foxglove WebSocket

### How do I load a large bag file?

Large files are automatically streamed rather than loaded entirely into memory. However, for optimal performance:
1. Use MCAP format when possible
2. Consider splitting very large recordings into smaller chunks
3. Use the desktop application for large files, as it generally provides better performance

### Can I record data with Lichtblick?

Lichtblick is primarily a visualization tool, not a recording tool. Use standard ROS tools like `rosbag` for recording data, then visualize it in Lichtblick.

## Features and Functionality

### How do I create custom visualizations?

You have several options:
1. Use the Plot Panel with custom expressions
2. Use the User Script panel to transform and visualize data
3. Create a custom extension with custom panels
4. Contribute new panel types to the core project

### Can I extend Lichtblick functionality?

Yes, Lichtblick has an extension system that allows you to:
- Create custom visualization panels
- Add support for new data sources
- Add new message converters for specialized formats

### How do I share my layouts with others?

You can export your layouts from the Layout Manager and share the resulting JSON file with others. They can then import the layout through their Layout Manager.

### Can I use Lichtblick in my CI/CD pipeline?

While Lichtblick is primarily designed as an interactive tool, you can use the desktop app in headless mode for some automated tasks. See the developer documentation for more details.

## Troubleshooting

### Lichtblick is slow when visualizing 3D data

3D visualization can be resource-intensive. Try these solutions:
1. Reduce the point cloud density in the panel settings
2. Lower the maximum frames per second in the application settings
3. Disable unnecessary visual elements
4. Consider hardware with better GPU support

### I'm having issues connecting to my ROS system

Common solutions include:
1. Check that your ROS_MASTER_URI is correctly set
2. Ensure any firewalls allow the necessary ports
3. For Rosbridge connections, verify the WebSocket server is running
4. Check the connection logs in Lichtblick for specific error messages

### My bag file won't load

Check that:
1. The file format is supported (.bag, .mcap, .ulog)
2. The file is not corrupted
3. You have permissions to read the file
4. For very large files, you have sufficient memory

### Panels are not showing any data

Common causes include:
1. No topic is selected in the panel settings
2. The selected topic doesn't publish messages
3. The message format is not compatible with the panel
4. The timestamps are outside the current playback range

## Development

### How do I contribute to Lichtblick?

See our [Contributing Guide](../CONTRIBUTING.md) for details on:
1. Setting up a development environment
2. Contributing code
3. Submitting pull requests

### Where can I report bugs or request features?

Please submit issues on our [GitHub repository](https://github.com/lichtblick-suite/lichtblick/issues).

### How do I build Lichtblick from source?

See the [Developer Guide](developer-guide.md) for detailed instructions on building from source.

### Can I use Lichtblick code in my own project?

Yes, under the terms of the Mozilla Public License v2.0. This generally means you can use the code, but modifications to Lichtblick code must be shared. See the [LICENSE](../LICENSE) file for details.
