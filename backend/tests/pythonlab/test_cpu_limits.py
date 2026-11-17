import threading
import time

from app.api.pythonlab.cpu_limits import run_cpu


def test_run_cpu_bounds_concurrency():
    entered = 0
    peak = 0
    release = threading.Event()
    lock = threading.Lock()

    def work():
        nonlocal entered, peak
        with lock:
            entered += 1
            peak = max(peak, entered)
        release.wait(timeout=2)
        with lock:
            entered -= 1

    threads = [threading.Thread(target=run_cpu, args=(work,)) for _ in range(4)]
    for thread in threads:
        thread.start()

    deadline = time.time() + 2
    while time.time() < deadline:
        with lock:
            if entered == 2:
                break
        time.sleep(0.01)

    with lock:
        assert entered == 2

    time.sleep(0.1)
    with lock:
        assert entered == 2
        assert peak == 2

    release.set()
    for thread in threads:
        thread.join(timeout=2)
    assert all(not thread.is_alive() for thread in threads)
