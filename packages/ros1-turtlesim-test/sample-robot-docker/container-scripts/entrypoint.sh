#!/usr/bin/env bash

source ~/catkin_ws/devel/setup.bash

roslaunch rosbridge_server rosbridge_websocket.launch &

xvfb-run --auto-servernum rosrun turtlesim turtlesim_node
