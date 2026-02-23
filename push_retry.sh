#!/bin/bash
IMAGE="shuhao07/wangsh-typst-worker:1.0.1"
MAX_RETRIES=20
count=0

echo "Starting robust push for $IMAGE..."

until docker push "$IMAGE"; do
    exit_code=$?
    count=$((count + 1))
    echo "Push failed with exit code $exit_code. Retry $count/$MAX_RETRIES in 5 seconds..."
    if [ $count -ge $MAX_RETRIES ]; then
        echo "Failed to push $IMAGE after $MAX_RETRIES attempts."
        exit 1
    fi
    sleep 5
done

echo "Successfully pushed $IMAGE!"
