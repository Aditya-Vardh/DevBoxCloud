DevBox Cloud
Your development environment, in the browser.

DevBox Cloud is a Kubernetes-powered platform for creating on-demand development environments. Choose a template, create an environment, and work in a browser-based terminal or a full Linux desktop — without installing the development toolchain directly on your computer.
<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=springboot&logoColor=white" alt="Spring Boot 4.1" />
  <img src="https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white" alt="Java 21" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Docker-enabled-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Kubernetes-Minikube-326CE5?logo=kubernetes&logoColor=white" alt="Kubernetes with Minikube" />
</p>

What you can do
- Create environments on demand from six development templates.
- Code in the browser with a terminal and a full Linux desktop.
- Use familiar toolchains for Java, Python, Node.js, React, and full-stack work.
- Manage environment lifecycles by starting, stopping, and deleting environments.
- Keep files across stop/start using the workspace's persistent storage.
- Run locally with Docker, Minikube, PostgreSQL, and the included Maven wrapper.
Development templates
Template	Included tools
Ubuntu Development	Bash, Git, curl, Vim, htop, build tools
Python Development	Python 3.12, pip, virtual environments
Node.js Development	Node.js 20, npm, npx
Java Development	OpenJDK 21, javac, Maven, Gradle
React Development	Node.js 20, npm, Vite
Full Stack Development	Node.js, Python, Java, Maven, PostgreSQL client, Docker CLI


Implementation note: The current implementation uses a shared workspace image. Template selection configures the environment's defaults and presentation; each template does not have a separate container image.

How it works
Browser
   │
   ▼
React + Vite frontend (:5173)
   │  /api
   ▼
Spring Boot REST API (:8080) ───── PostgreSQL (:5433)
   │
   ▼
Kubernetes on Minikube
   │
   ▼
Workspace Pod
   ├── nginx gateway
   ├── ttyd browser terminal
   ├── TigerVNC + XFCE + noVNC desktop
   └── /workspace persistent storage
Tech stack
Layer	Technologies
Frontend	React 18, Vite
Backend	Java 21, Spring Boot, Spring Data JPA
Database	PostgreSQL 16
Workspace runtime	Docker, Kubernetes, Minikube
Browser terminal	ttyd
Browser desktop	TigerVNC, XFCE, noVNC
Web gateway	nginx
Tests	JUnit 5, in-memory H2 for tests


Run locally
These instructions are for Windows PowerShell. macOS/Linux alternatives are included where needed.
Prerequisites
Install and start the following tools:
Tool	Version / requirement	Verify
Git	Any recent version	git --version
Java JDK	21	java --version
Node.js	20 or newer	node --version
Docker Desktop	Installed and running	docker ps
Minikube	1.33+	minikube version
kubectl	1.29+	kubectl version --client


Maven does not need to be installed separately; the backend includes the Maven Wrapper. A machine with 8 GB RAM or more and around 15 GB of free disk space is recommended. The initial workspace image build may take 10–25 minutes, depending on your connection and machine.
1. Clone the repository
git clone https://github.com/Aditya-Vardh/DevBoxCloud.git
cd DevBoxCloud
2. Start PostgreSQL
Make sure Docker Desktop is running, then run from the repository root:
docker compose up -d
docker compose ps
Wait until the database service reports that it is healthy before continuing.
3. Start Minikube
minikube start --driver=docker --cpus=4 --memory=4096
kubectl config use-context minikube
kubectl get nodes
Confirm the node is in the Ready state. If your machine is under memory pressure, close other applications before continuing.
4. Build and load the workspace image
Run these commands from the repository root:
docker build -t devbox/workspace:latest ./workspace-image
minikube image load devbox/workspace:latest
minikube image ls | findstr devbox
Make sure devbox/workspace:latest appears in the image list. This is the image used by the workspace pods.
5. Start the backend
Open Terminal 1:
cd backend
.\mvnw.cmd spring-boot:run
On macOS/Linux:
cd backend
chmod +x mvnw
./mvnw spring-boot:run
Wait for Spring Boot to finish starting. Keep this terminal open.
6. Start the frontend
Open Terminal 2 from the repository root:
cd frontend
npm install
npm run dev
Open http://localhost:5173 in your browser.
Create your first environment
1. Open DevBox Cloud and select Get started.
2. Create a workspace using New Workspace.
3. Inside the workspace, select New Environment.
4. Choose a template, enter a name, and create the environment.
5. Wait for its status to change from Starting to Running.
6. Open the workspace landing page, Terminal, or Desktop.
Environment startup may take around 30–75 seconds, depending on your machine and cluster state.
Try a starter program
Template	Example command
Java	cd /workspace/starter && javac Hello.java && java Hello
Python	python3 /workspace/starter/hello.py
Node.js	node /workspace/starter/hello.js
Ubuntu	bash /workspace/starter/welcome.sh


Stop is intended to retain workspace files. Delete removes the environment and its files.
Useful ports
Port	Service
5173	Vite development server
8080	Spring Boot API
5433	PostgreSQL
Dynamic	Per-environment Kubernetes port-forwarding


Make sure the fixed ports are available before starting the application.
Daily startup
After the initial setup, start Docker Desktop and run:
docker compose up -d
minikube start
Then start the backend in Terminal 1:
cd backend
.\mvnw.cmd spring-boot:run
Start the frontend in Terminal 2:
cd frontend
npm run dev
Run tests
Backend tests use an in-memory H2 database, so the test command does not require PostgreSQL or a running Kubernetes cluster:
cd backend
.\mvnw.cmd test
On macOS/Linux, run ./mvnw test.
Troubleshooting
Issue	What to check
Docker commands fail	Open Docker Desktop and wait for it to finish starting.
Backend cannot connect to PostgreSQL	Run docker compose ps, check database health, and verify port 5433 is not occupied.
Kubernetes client fails to initialize	Start Minikube and verify with kubectl cluster-info.
ErrImageNeverPull or ImagePullBackOff	Rebuild the workspace image and run minikube image load devbox/workspace:latest.
Environment remains on Starting	Check pod status with kubectl get pods -n devbox.
Workspace pod crashes	Inspect logs with kubectl logs <pod-name> -n devbox.
Terminal or Desktop fails to load	Confirm the environment is Running, wait briefly, and refresh the page.
Port 8080 is already in use	Stop the other process or previous backend instance using that port.
Maven wrapper permission error on macOS/Linux	Run chmod +x backend/mvnw.
Memory pressure	Stop unused applications/environments and check Minikube's allocated memory.


To inspect Kubernetes resources:
kubectl get pods -n devbox
kubectl get services -n devbox
kubectl get events -n devbox --sort-by=.metadata.creationTimestamp
Warning: The following commands remove local data and cluster resources. Use them only when you intentionally want a complete reset.
docker compose down -v
minikube delete

Project structure
DevBoxCloud/
├── backend/            Spring Boot REST API and backend tests
├── frontend/           React + Vite application
├── workspace-image/    Dockerfile and workspace startup/configuration
├── k8s/                Kubernetes manifests
├── helm/devbox/        Helm chart
├── scripts/            Utility and verification scripts
└── docker-compose.yml  Local PostgreSQL service
The repository also contains server/, client/, and drizzle/ directories from an earlier Node/tRPC prototype. These are not part of the current React + Spring Boot runtime described above.
Access from another device on the same Wi-Fi
For a local demonstration, you can open the frontend from another device on the same network. Find your computer's LAN IP address, then set the workspace host before starting the backend:
$env:DEVBOX_WORKSPACE_HOST = "<your-lan-ip>"
cd backend
.\mvnw.cmd spring-boot:run
On the other device, open http://<your-lan-ip>:5173. Allow the required ports through your firewall only on a trusted network. This is a local-network demo, not a public production deployment.
Notes
- This README describes the local development workflow; it does not claim that a public hosted demo is available.
- Do not expose local API or database ports to the public internet without appropriate authentication, network controls, and production configuration.
- Workspace templates currently share the same base image, with template-specific defaults and presentation.
Contributing
Issues and pull requests are welcome. For a useful bug report, include your operating system, the command you ran, the complete error message, and whether Docker and Minikube were running.
License
No license information is specified here yet. Add a LICENSE file if you intend to grant others permission to use, modify, and distribute the project.
