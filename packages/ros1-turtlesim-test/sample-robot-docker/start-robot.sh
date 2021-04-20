#!/usr/bin/env bash

set -x

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd $DIR

# Including the roscore XML-RPC server, the full range of ports we bind on the host is 11311-11370.
# This is the roscore default port up through a series of ports with few IANA reservations
ROSCORE_PORT=11311
MIN_PORT=11312
MAX_PORT=11366
HOSTNAME="$(hostname)"

./build-robot.sh || exit 1

mkdir -p $HOME/.ros

docker run \
  -it \
  --rm \
  --sysctl net.ipv4.ip_local_port_range="${MIN_PORT} ${MAX_PORT}" \
  --hostname ${HOSTNAME} \
  -e ROS_MASTER_URI="http://${HOSTNAME}:${ROSCORE_PORT}/" \
  -e ROS_HOSTNAME="${HOSTNAME}" \
  -p ${ROSCORE_PORT}-${MAX_PORT}:${ROSCORE_PORT}-${MAX_PORT} \
  -v ${HOME}/.ros:/home/rosuser/.ros \
  --name sample-robot \
  sample-robot
