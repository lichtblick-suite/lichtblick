# rosmsg-msgs-common

This library exports a map of ROS dataType string keys to `RosMsgDefinition`
values for most common ROS1 message definitions. The message definitions were
extracted from the `ros:noetic-robot-focal` Docker container using the
`gendeps --cat` command.
