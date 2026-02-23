import subprocess
import time
import sys

def push_image(image):
    max_retries = 5
    for i in range(max_retries):
        print(f"Attempting to push {image} (Attempt {i+1}/{max_retries})...")
        try:
            subprocess.run(["docker", "push", image], check=True)
            print(f"Successfully pushed {image}")
            return True
        except subprocess.CalledProcessError:
            print(f"Failed to push {image}. Retrying in 5 seconds...")
            time.sleep(5)
    return False

images = [
    "shuhao07/wangsh-typst-worker:1.0.1",
    "shuhao07/wangsh-typst-worker:latest",
    "shuhao07/wangsh-pythonlab-worker:1.0.1",
    "shuhao07/wangsh-pythonlab-worker:latest"
]

failed_images = []

for img in images:
    if not push_image(img):
        failed_images.append(img)

if failed_images:
    print("\nFailed to push the following images after multiple attempts:")
    for img in failed_images:
        print(f"- {img}")
    sys.exit(1)
else:
    print("\nAll images pushed successfully!")
    sys.exit(0)
