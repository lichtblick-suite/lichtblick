#!/usr/bin/env bash

mkdir -p ~/catkin_ws/src
cd ~/catkin_ws/
source /opt/ros/noetic/setup.bash
catkin_make
