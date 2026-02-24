#!/bin/bash
VERSION="1.0.2"
REGISTRY="shuhao07"
MAX_RETRIES=50

IMAGES=(
  "wangsh-backend"
  "wangsh-frontend"
  "wangsh-gateway"
  "wangsh-typst-worker"
  "wangsh-pythonlab-worker"
)

push_image() {
    local img_name=$1
    local tag=$2
    local full_image="${REGISTRY}/${img_name}:${tag}"
    local count=0
    
    echo "----------------------------------------"
    echo "Starting robust push for $full_image..."
    
    until docker push "$full_image"; do
        exit_code=$?
        count=$((count + 1))
        echo "Push failed with exit code $exit_code. Retry $count/$MAX_RETRIES in 5 seconds..."
        if [ $count -ge $MAX_RETRIES ]; then
            echo "Failed to push $full_image after $MAX_RETRIES attempts."
            return 1
        fi
        sleep 5
    done
    echo "Successfully pushed $full_image!"
    return 0
}

# Push all versioned images
for IMG in "${IMAGES[@]}"; do
    push_image "$IMG" "$VERSION" || exit 1
done

# Push all latest images
for IMG in "${IMAGES[@]}"; do
    push_image "$IMG" "latest" || exit 1
done

echo "========================================"
echo "All images pushed successfully!"
