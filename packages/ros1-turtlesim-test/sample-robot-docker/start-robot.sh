#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd $DIR

./build-robot.sh || exit 1

mkdir -p $HOME/.ros

docker run \
  -it \
  --rm \
  --net=host \
  -v $HOME/.ros:/home/rosuser/.ros \
  --name sample-robot \
  sample-robot
