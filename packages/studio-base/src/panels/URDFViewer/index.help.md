# URDF Viewer

Drag and drop a Unified Robot Description Format ([URDF](http://wiki.ros.org/urdf)) file to visualize it.

Select a [`sensor_msgs/JointState`](https://docs.ros.org/en/noetic/api/sensor_msgs/html/msg/JointState.html) or [`sensor_msgs/msg/JointState`](https://github.com/ros2/common_interfaces/blob/master/sensor_msgs/msg/JointState.msg) topic to update the visualization based on the published joint states. Alternatively, toggle to `Manual joint control` to set joint positions using the provided controls.

When connected to a live ROS system, the panel will also display the `/robot_description` parameter.

[Learn more](https://foxglove.dev/docs/panels/urdf-viewer).
