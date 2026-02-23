import asyncio
import logging
import json
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.sandbox.base import SandboxProvider, get_sitecustomize_content

logger = logging.getLogger(__name__)

try:
    from kubernetes import client, config, watch
    from kubernetes.client.rest import ApiException
    HAS_K8S = True
except ImportError:
    HAS_K8S = False

class K8sProvider(SandboxProvider):
    """
    Kubernetes Sandbox Provider (Phase 3).
    
    Uses Kubernetes Pods to isolate sessions.
    Requires 'kubernetes' python package and proper cluster configuration.
    """
    
    def __init__(self):
        self.namespace = "default" # TODO: Make configurable via settings
        self.image = getattr(settings, "PYTHONLAB_SANDBOX_IMAGE", "shuhao07/pythonlab-sandbox:py311")
        self.debugpy_port = int(getattr(settings, "PYTHONLAB_DEBUGPY_PORT", 5678) or 5678)
        self.runtime_class = getattr(settings, "PYTHONLAB_DOCKER_RUNTIME", None)
        if self.runtime_class == "runc":
            self.runtime_class = None # runc is usually default, no need to specify class unless configured
            
        self.api_core = None
        if HAS_K8S:
            try:
                try:
                    config.load_incluster_config()
                    logger.info("Loaded in-cluster k8s config")
                except:
                    config.load_kube_config()
                    logger.info("Loaded local kube-config")
                self.api_core = client.CoreV1Api()
            except Exception as e:
                logger.error(f"Failed to load k8s config: {e}")
        else:
            logger.warning("kubernetes package not installed. K8sProvider will not work.")

    async def start_session(self, session_id: str, code: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_core:
            raise RuntimeError("Kubernetes client not initialized")
            
        name = f"pythonlab-{session_id}"
        
        # 1. Create ConfigMap
        cm_body = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(name=name, labels={"app": "pythonlab", "session": session_id}),
            data={
                "main.py": code,
                "meta.json": json.dumps(meta, ensure_ascii=False),
                "sitecustomize.py": get_sitecustomize_content()
            }
        )
        
        try:
            self.api_core.create_namespaced_config_map(self.namespace, cm_body)
        except ApiException as e:
            if e.status == 409:
                self.api_core.replace_namespaced_config_map(name, self.namespace, cm_body)
            else:
                raise RuntimeError(f"K8s CM creation failed: {e}")

        # 2. Create Pod
        mem_mb = int(meta.get("limits", {}).get("memory_mb") or 512)
        
        pod_body = client.V1Pod(
            metadata=client.V1ObjectMeta(name=name, labels={"app": "pythonlab", "session": session_id}),
            spec=client.V1PodSpec(
                automount_service_account_token=False,
                runtime_class_name=self.runtime_class,
                containers=[
                    client.V1Container(
                        name="sandbox",
                        image=self.image,
                        image_pull_policy="IfNotPresent",
                        command=["sh", "-c"],
                        args=[
                            f"python -m debugpy.adapter --host 0.0.0.0 --port {self.debugpy_port} --log-stderr"
                        ],
                        env=[
                            client.V1EnvVar(name="PYTHONPATH", value="/workspace"),
                            client.V1EnvVar(name="PYTHONUNBUFFERED", value="1")
                        ],
                        ports=[client.V1ContainerPort(container_port=self.debugpy_port)],
                        resources=client.V1ResourceRequirements(
                            limits={"memory": f"{mem_mb}Mi", "cpu": "500m"},
                            requests={"memory": "64Mi", "cpu": "100m"}
                        ),
                        volume_mounts=[
                            client.V1VolumeMount(name="workspace", mount_path="/workspace", read_only=True)
                        ],
                        security_context=client.V1SecurityContext(
                            allow_privilege_escalation=False,
                            run_as_user=1000,
                            run_as_group=1000,
                            capabilities=client.V1Capabilities(drop=["ALL"])
                        )
                    )
                ],
                volumes=[
                    client.V1Volume(
                        name="workspace",
                        config_map=client.V1ConfigMapVolumeSource(name=name)
                    )
                ],
                restart_policy="Never"
            )
        )

        try:
            self.api_core.create_namespaced_pod(self.namespace, pod_body)
        except ApiException as e:
             # If exists, maybe delete and recreate?
             if e.status == 409:
                 try:
                    self.api_core.delete_namespaced_pod(name, self.namespace)
                 except: pass
                 # We can't immediately recreate, K8s takes time to terminate. 
                 # For now, just fail.
                 raise RuntimeError(f"Pod {name} already exists. Please retry in a few seconds.")
             raise RuntimeError(f"K8s Pod creation failed: {e}")

        # 3. Wait for Pod Running and get IP
        pod_ip = None
        for _ in range(60): # 30 seconds wait
            try:
                pod = self.api_core.read_namespaced_pod(name, self.namespace)
                if pod.status.phase == "Running":
                    pod_ip = pod.status.pod_ip
                    break
                if pod.status.phase in ["Failed", "Succeeded"]:
                    raise RuntimeError(f"Pod exited unexpectedly: {pod.status.phase}")
            except ApiException:
                pass
            except Exception:
                pass
            await asyncio.sleep(0.5)
            
        if not pod_ip:
             raise RuntimeError("Pod failed to start or acquire IP within timeout")

        return {
            "k8s_pod_name": name,
            "dap_host": pod_ip,
            "dap_port": self.debugpy_port
        }

    async def stop_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        if not self.api_core: return
        name = f"pythonlab-{session_id}"
        
        try:
            self.api_core.delete_namespaced_pod(name, self.namespace, grace_period_seconds=0)
        except ApiException:
            pass
            
        try:
            self.api_core.delete_namespaced_config_map(name, self.namespace)
        except ApiException:
            pass

    async def list_active_sessions(self) -> List[str]:
        if not self.api_core: return []
        try:
            pods = self.api_core.list_namespaced_pod(
                self.namespace, 
                label_selector="app=pythonlab"
            )
            res = []
            for p in pods.items:
                # pythonlab-<session_id>
                if p.metadata.name.startswith("pythonlab-"):
                    res.append(p.metadata.name[len("pythonlab-"):])
            return res
        except Exception:
            return []
        
    async def is_healthy(self, session_id: str, meta: Dict[str, Any]) -> bool:
        if not self.api_core: return False
        name = f"pythonlab-{session_id}"
        try:
            pod = self.api_core.read_namespaced_pod(name, self.namespace)
            return pod.status.phase == "Running"
        except ApiException:
            return False
