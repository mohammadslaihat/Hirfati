#!/usr/bin/env bash
# Hirfati - prepares the separate EBS data volume on EC2 B and mounts it at /data.
# Formats the disk ONLY if it is empty, so running it again never erases data.
set -euo pipefail
MOUNT=/data

ROOT_DISK=$(lsblk -no PKNAME "$(findmnt -no SOURCE /)")
DEV=""
for d in $(lsblk -dno NAME,TYPE | awk '$2=="disk"{print $1}'); do
  [ "$d" = "$ROOT_DISK" ] && continue
  DEV="/dev/$d"
done
[ -n "$DEV" ] || { echo "ERROR: data disk not found"; exit 1; }
echo "Data disk: $DEV"

if blkid "$DEV" >/dev/null 2>&1; then
  echo "Disk already has a filesystem - NOT formatting"
else
  echo "Disk is empty - creating ext4 filesystem"
  mkfs.ext4 -L hirfati-data "$DEV"
fi

mkdir -p "$MOUNT"
UUID=$(blkid -s UUID -o value "$DEV")
grep -q "$UUID" /etc/fstab || echo "UUID=$UUID $MOUNT ext4 defaults,nofail 0 2" >> /etc/fstab
mountpoint -q "$MOUNT" || mount "$MOUNT"
mkdir -p "$MOUNT/mysql"

echo "----- RESULT -----"
df -h "$MOUNT"
grep "$MOUNT" /etc/fstab
