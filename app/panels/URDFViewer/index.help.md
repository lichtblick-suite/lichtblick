# URDF Viewer

Drag and drop a URDF file to visualize it. Selecting a [sensor_msgs/JointState](https://docs.ros.org/en/noetic/api/sensor_msgs/html/msg/JointState.html) topic (`/joint_states` by default) will update the visualization based on the published joint states. Alternatively, toggle to manual control to set join positions using sliders.

When connected to a ROS data source, the `/robot_description` parameter will be automatically displayed in the URDF Viewer.

To learn more about URDFs, visit the [ROS URDF Tutorials](https://wiki.ros.org/urdf/Tutorials).
