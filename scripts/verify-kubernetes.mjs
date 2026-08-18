import { KubernetesProvider } from "../server/kubernetes.ts";

if (process.env.CNAD32_KUBERNETES_VERIFICATION !== "yes") {
  throw new Error(
    "Set CNAD32_KUBERNETES_VERIFICATION=yes to create and remove real verification resources."
  );
}

const runId = `${Date.now()}`.slice(-8);
const environment = {
  id: Number(runId),
  userId: 1,
  name: `minikube-verification-${runId}`,
  description: "Temporary real Kubernetes verification workload.",
  templateId: 1,
  status: "provisioning",
  runtime: "node",
  cpuLimit: "250m",
  memoryLimit: "512Mi",
  storageLimit: "1Gi",
  port: 3000,
  repositoryUrl: null,
  branch: null,
  namespace: `cnad-e2e-${runId}`,
  deploymentName: "workspace",
  serviceName: "workspace",
  persistentVolumeClaimName: "workspace-data",
  accessUrl: null,
  failureReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: null,
  stoppedAt: null,
  deletedAt: null,
};

const template = {
  id: 1,
  name: "Node.js Workspace",
  slug: "node",
  description: "Temporary verification template.",
  runtime: "node",
  image: "node:22-bookworm-slim",
  defaultCpu: "250m",
  maxCpu: "2",
  defaultMemory: "512Mi",
  maxMemory: "4Gi",
  defaultStorage: "1Gi",
  maxStorage: "20Gi",
  allowedPorts: [3000],
  configurationSchema: {},
  active: "true",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const provider = new KubernetesProvider();
const workspace = { environment, template };

async function waitFor(expectedStatus, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  let observed;
  while (Date.now() < deadline) {
    observed = await provider.getEnvironmentStatus(workspace);
    if (observed.status === expectedStatus) return observed;
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error(
    `Timed out waiting for ${expectedStatus}; last observed status was ${observed?.status ?? "none"}.`
  );
}

try {
  const health = await provider.health();
  if (!health.healthy)
    throw new Error(`Kubernetes API unavailable: ${health.message}`);

  console.log(`Creating temporary namespace ${environment.namespace}`);
  await provider.createEnvironment(workspace);
  await waitFor("running");
  console.log("Environment reached running state.");

  await provider.stopEnvironment(workspace);
  await waitFor("stopped");
  console.log("Environment reached stopped state.");

  await provider.startEnvironment(workspace);
  await waitFor("running");
  console.log("Environment returned to running state.");

  await provider.restartEnvironment(workspace);
  await waitFor("running");
  console.log(
    "Environment restart was accepted and the deployment is running."
  );

  await provider.deleteEnvironment(workspace);
  console.log("Kubernetes namespace cleanup completed.");
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Kubernetes verification failed."
  );
  try {
    await provider.deleteEnvironment(workspace);
    console.error(
      "Temporary verification namespace cleanup completed after failure."
    );
  } catch {
    console.error(
      `Manual cleanup may be required for namespace ${environment.namespace}.`
    );
  }
  process.exitCode = 1;
}
