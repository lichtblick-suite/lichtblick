# Vagrant

The purpose of this package is to allow you to run a complete graphical Ubuntu ROS 1+2 environment inside a VM, for testing on non-Linux platforms. VirtualBox is used by default, but it should presumably work with other Vagrant providers.

To get started:

```sh
$ vagrant up        # Create and start the VM (reload after the first provision to boot into desktop mode)
$ vagrant ssh       # SSH into the VM
$ vagrant reload    # Restart the VM
$ vagrant destroy   # Destroy the VM
```

- The VM is accessible at `192.168.33.10`.
- The default username is `vagrant` with password `vagrant`.
