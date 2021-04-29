#!/usr/bin/env bash

source ~/catkin_ws/devel/setup.bash

roscore &

xvfb-run --auto-servernum rosrun turtlesim turtlesim_node
