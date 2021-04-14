# Topic Graph

Display a graph visualization of the current node and topic topology. Connect to a live ROS system using the native connector for best results.

### Legend

- <span style="color:rgb(69, 165, 255)">Blue</span> rectangles - Nodes. These connect to topics as either subscribers or publishers, and services.
- <span style="color:rgb(183, 157, 202)">Purple</span> diamonds - Topics. These directionally connect to nodes to show publishers and subscribers for each topic.
- <span style="color:rgb(255, 107, 130)">Red</span> rectangles - Services. These connect to the nodes that implement them.
