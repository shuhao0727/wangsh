#!/bin/bash
# ============================================
# PythonLab Host Optimization Script
# ============================================
#
# This script prepares the host environment for high-concurrency PythonLab usage (e.g., 60+ users).
# It creates the workspace directory and mounts it as a RAM disk (tmpfs) to optimize I/O.
#
# Usage: sudo ./optimize_host_for_pythonlab.sh [size_in_gb]
# Default size: 4G
#
# ============================================

set -e

# Default settings
WORKSPACE_DIR="./data/pythonlab/workspaces"
TMPFS_SIZE="4G"

# Allow overriding size
if [ ! -z "$1" ]; then
    TMPFS_SIZE="$1"
fi

# Get absolute path
ABS_WORKSPACE_DIR=$(readlink -f "$WORKSPACE_DIR" || echo "$PWD/${WORKSPACE_DIR#./}")

echo "🚀 Starting PythonLab Host Optimization..."
echo "📂 Workspace Directory: $ABS_WORKSPACE_DIR"
echo "💾 Tmpfs Size: $TMPFS_SIZE"

# 1. Ensure directory exists
if [ ! -d "$ABS_WORKSPACE_DIR" ]; then
    echo "Creating directory: $ABS_WORKSPACE_DIR"
    mkdir -p "$ABS_WORKSPACE_DIR"
    # Set permissions so the container (uid 1000) can write
    chmod 777 "$ABS_WORKSPACE_DIR"
else
    echo "✅ Directory already exists."
fi

# 2. Check if already mounted
# (Disabled by default for low-memory environments)
# If you have plenty of RAM (32GB+), you can uncomment the mount logic below to speed up I/O.

# if mount | grep -q "$ABS_WORKSPACE_DIR"; then
#     echo "✅ Tmpfs is already mounted at $ABS_WORKSPACE_DIR"
# else
#     echo "Mounting tmpfs (RAM Disk)..."
#     if [ "$EUID" -ne 0 ]; then 
#         sudo mount -t tmpfs -o size=$TMPFS_SIZE,mode=1777,uid=1000,gid=1000 tmpfs "$ABS_WORKSPACE_DIR"
#     else
#         mount -t tmpfs -o size=$TMPFS_SIZE,mode=1777,uid=1000,gid=1000 tmpfs "$ABS_WORKSPACE_DIR"
#     fi
# fi

echo "ℹ️  Skipping Tmpfs mount (using disk I/O to save RAM)."


# 3. Check Sysctl limits (Optional but recommended for high concurrency)
echo "🔍 Checking system limits..."
ulimit_n=$(ulimit -n)
echo "Current file descriptor limit: $ulimit_n"
if [ "$ulimit_n" -lt 65535 ]; then
    echo "⚠️  Recommended ulimit -n is 65535 or higher for 60+ containers."
    echo "You may want to run: ulimit -n 65535"
fi

echo "🎉 Optimization complete! PythonLab is ready for high concurrency."
