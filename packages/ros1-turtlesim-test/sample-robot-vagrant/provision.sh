# Provision Vagrant VM
# This script must be idempotent

set -euxo pipefail

# Install Ubuntu Desktop
apt-get update
apt-get install -qq ubuntu-desktop-minimal net-tools gnupg2

# Add ROS sources
curl -fsSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.asc | apt-key add -
sh -c 'echo "deb [arch=$(dpkg --print-architecture)] http://packages.ros.org/ros/ubuntu $(lsb_release -cs) main" > /etc/apt/sources.list.d/ros-latest.list'
sh -c 'echo "deb [arch=$(dpkg --print-architecture)] http://packages.ros.org/ros2/ubuntu $(lsb_release -cs) main" > /etc/apt/sources.list.d/ros2-latest.list'
apt-get update

# Install ROS 1
apt-get install -qq ros-noetic-desktop ros-noetic-rosbridge-suite

# Install ROS 2
apt-get install -qq ros-foxy-desktop

# Add ROS config to bashrc
sudo -su vagrant bash -eux -o pipefail <<EOF
if ! grep -q '/opt/ros' ~/.bashrc; then
    echo >> ~/.bashrc
    echo "source /opt/ros/noetic/setup.bash  # ros1" >> ~/.bashrc
    echo "# source /opt/ros/foxy/setup.bash  # ros2" >> ~/.bashrc
    echo "export ROS_HOSTNAME=192.168.33.10" >> ~/.bashrc
fi
EOF
