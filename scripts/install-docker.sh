#!/usr/bin/env bash
# Hirfati - installs Docker Engine + Compose plugin (official Docker repo, Ubuntu)
# and adds a 1 GB swap file (t3.micro has only ~1 GB RAM). Safe to run more than once.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if command -v docker >/dev/null 2>&1; then
  echo "Docker already installed"
else
  apt-get update -y
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
usermod -aG docker ubuntu

if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "----- RESULT -----"
docker --version
docker compose version
free -h | head -3
