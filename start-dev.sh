#!/bin/bash
# ============================================
# WangSh 项目统一启动脚本
# 功能：启动本地开发环境（Docker基础设施 + 后端 + 前端）
# 版本：3.0.0
# 改进：强制停止占用端口的进程，更好的端口管理
# ============================================

set -euo pipefail  # 遇到错误、未定义变量、管道失败立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"

# 端口配置
BACKEND_PORT=8000
FRONTEND_PORT=6608
# 宿主机 5432 通常被本机 Homebrew PostgreSQL 占用，开发栈发布在 5433
POSTGRES_PORT=5433
REDIS_PORT=6379

# 日志文件
LOG_DIR="/tmp/wangsh"
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"
CELERY_LOG="${LOG_DIR}/celery.log"
mkdir -p "${LOG_DIR}"

# 函数：打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

set_default_env() {
    local name="$1"
    local value="$2"

    if [ -z "${!name+x}" ]; then
        export "${name}=${value}"
    fi
}

# 函数：判断后端是否启用了交互式 API 文档（与 backend/main.py 的 DEBUG 判断一致）
api_docs_enabled() {
    # Docker 模式的 DEBUG 由开发 Compose 固定为 True；宿主覆盖仅作用于 local。
    if [ "${START_MODE:-local}" = "docker" ]; then return 0; fi
    case "$(printf '%s' "${DEBUG:-False}" | tr '[:upper:]' '[:lower:]')" in
        1|true|yes|on) return 0 ;;
        *) return 1 ;;
    esac
}

is_docker_local_host_alias() {
    local value="$1"
    case "${value}" in
        postgres|redis|wangsh-postgres|wangsh-redis)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

spawn_detached_process() {
    local workdir="$1"
    local log_file="$2"
    shift 2

    python3 - "$workdir" "$log_file" "$@" <<'PY'
import os
import subprocess
import sys

workdir = sys.argv[1]
log_file = sys.argv[2]
command = sys.argv[3:]

with open(log_file, "ab", buffering=0) as log_handle, open(os.devnull, "rb") as stdin_handle:
    process = subprocess.Popen(
        command,
        cwd=workdir,
        stdin=stdin_handle,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )

print(process.pid)
PY
}

load_env_file() {
    local env_file="$1"

    if [ ! -f "${env_file}" ]; then
        return 0
    fi

    print_info "加载环境文件: ${env_file}"

    while IFS= read -r raw_line || [ -n "${raw_line}" ]; do
        local line="${raw_line}"

        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"

        if [ -z "${line}" ]; then
            continue
        fi
        if [[ "${line}" == \#* ]]; then
            continue
        fi
        if [[ "${line}" == export\ * ]]; then
            line="${line#export }"
        fi
        if [[ ! "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
            continue
        fi

        local key="${line%%=*}"
        local val="${line#*=}"

        val="${val#"${val%%[![:space:]]*}"}"
        val="${val%"${val##*[![:space:]]}"}"

        if [[ "${val}" == \"*\" && "${val}" == *\" ]]; then
            val="${val:1:${#val}-2}"
        elif [[ "${val}" == \'*\' && "${val}" == *\' ]]; then
            val="${val:1:${#val}-2}"
        else
            if [[ "${val}" == *" #"* ]]; then
                val="${val%% \#*}"
                val="${val%"${val##*[![:space:]]}"}"
            fi
        fi

        if [[ "${val}" == *'${'* ]]; then
            continue
        fi

        export "${key}=${val}"
    done < "${env_file}"

    print_success "环境文件加载完成: ${env_file}"
}

# 函数：校验环境文件里的必需变量
#
# .env.dev 不受版本控制，首次从 .env.dev.example 创建；加载个人覆盖后
# 核对最终必需值，防止空值或缺项落回运行时默认凭据。
check_required_env() {
    local env_file="$1"
    local missing=()
    local required=(
        POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
        SECRET_KEY SUPER_ADMIN_USERNAME SUPER_ADMIN_PASSWORD
        AGENT_API_KEY_ENCRYPTION_KEY CORS_ORIGINS
    )

    local key
    for key in "${required[@]}"; do
        local val
        val="${!key:-}"
        # 校验最终生效值（包含 .env.local），不把原文件中的非空值当作覆盖后的保证。
        val="${val#"${val%%[![:space:]]*}"}"
        val="${val%"${val##*[![:space:]]}"}"
        if [ -z "${val}" ]; then
            missing+=("${key}")
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        print_error "环境文件 ${env_file} 缺少必需变量（值为空也算缺失）:"
        local miss
        for miss in "${missing[@]}"; do
            echo "    - ${miss}"
        done
        echo ""
        echo "  这些变量在 docker-compose.dev.yml 里以 \${VAR} 直接引用，没有默认值。"
        echo "  空白值会导致：DATABASE_URL 拼装失败、CORS_ORIGINS 解析报错、"
        echo "  或密钥静默回退到内置默认值。"
        echo ""
        echo "  修法：对照 .env.dev.example 补齐。.env.dev 不在 git 里，"
        echo "  所以这处缺口只能在本机手动修复。"
        exit 1
    fi
    print_success "必需环境变量校验通过（${#required[@]} 项）"
}

# 函数：检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "命令 '$1' 未找到，请先安装"
        exit 1
    fi
}

check_docker_daemon() {
    if docker info > /dev/null 2>&1; then
        return 0
    fi

    local max_attempts=40
    local attempt=1

    if docker desktop --help > /dev/null 2>&1; then
        docker desktop start > /dev/null 2>&1 || true
    fi

    while ! docker info > /dev/null 2>&1; do
        if [ "${attempt}" -ge "${max_attempts}" ]; then
            print_error "Docker 守护进程未就绪，请先启动 Docker（Docker Desktop / dockerd）"
            exit 1
        fi
        sleep 2
        ((attempt++))
    done
}

# 函数：检查端口是否被占用
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "${service} 端口 ${port} 已被占用"
        
        # 获取占用进程信息
        local pids=$(lsof -ti:${port})
        for pid in $pids; do
            local process_info=$(ps -p $pid -o pid,ppid,user,command 2>/dev/null || echo "PID: $pid (进程可能已终止)")
            print_warning "占用进程信息:"
            echo "$process_info" | while read line; do
                echo "  $line"
            done
        done
        
        return 1
    fi
    return 0
}

# 监听者和换端口兜底共用归属判定；未知来源不发送信号。
dev_processes() {
    python3 -I -B "${PROJECT_ROOT}/scripts/dev-processes.py" --root "${PROJECT_ROOT}" "$@"
}

force_stop_port() {
    local port="$1"
    local service="$2"
    if ! dev_processes stop --port "${port}"; then
        print_error "${service} 的进程归属或退出状态无法确认，已停止后续启动"
        return 1
    fi
}

# 函数：停止已存在的本地进程
stop_existing_processes() {
    print_info "检查本项目的本地开发进程..."
    dev_processes stop || return 1
    local p
    if [ "${START_MODE:-local}" = "local" ]; then
        for p in "${BACKEND_PORT}" "${FRONTEND_PORT}"; do
            if lsof -Pi :"${p}" -sTCP:LISTEN -t >/dev/null 2>&1; then
                print_error "端口 ${p} 仍有占用（未授权停止的进程已保留），启动中止"
                return 1
            fi
        done
    fi
    print_success "已核准的本项目开发进程已停止"
}

# 函数：加载并核对实际开发配置；检查通过之前不创建数据目录。
setup_environment() {
    print_info "设置开发环境变量..."
    if [ ! -f "${PROJECT_ROOT}/.env.dev" ]; then
        print_error "缺少 .env.dev；请从 .env.dev.example 创建并填写独立开发凭据，禁止回退生产 .env"
        return 1
    fi
    load_env_file "${PROJECT_ROOT}/.env.dev"
    if [ -f "${PROJECT_ROOT}/.env.local" ]; then
        load_env_file "${PROJECT_ROOT}/.env.local"
    fi
    check_required_env "${PROJECT_ROOT}/.env.dev + .env.local"

    set_default_env POSTGRES_HOST "127.0.0.1"
    set_default_env POSTGRES_PORT "5433"
    set_default_env REDIS_HOST "127.0.0.1"
    set_default_env REDIS_PORT "6379"
    set_default_env DEPLOYMENT_ENV "development"
    set_default_env DATABASE_DRIVER "asyncpg"
    set_default_env REACT_APP_ENV "development"
    export POSTGRES_HOST POSTGRES_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_DRIVER
    export REDIS_HOST REDIS_PORT
    if [ "${DEPLOYMENT_ENV}" != "development" ] || [ "${REACT_APP_ENV}" != "development" ]; then
        print_error "开发入口要求 DEPLOYMENT_ENV/REACT_APP_ENV=development，请核对开发配置"
        return 1
    fi

    if [ "${START_MODE:-local}" = "local" ]; then
        if is_docker_local_host_alias "${POSTGRES_HOST:-}"; then export POSTGRES_HOST="127.0.0.1"; fi
        if is_docker_local_host_alias "${REDIS_HOST:-}"; then export REDIS_HOST="127.0.0.1"; fi
        set_default_env UPLOAD_FOLDER "${PROJECT_ROOT}/data/dev/uploads"
        set_default_env TYPST_PDF_STORAGE_DIR "${PROJECT_ROOT}/data/dev/typst_pdfs"
        if [ "${UPLOAD_FOLDER}" != "${PROJECT_ROOT}/data/dev/uploads" ]; then
            print_warning "显式 UPLOAD_FOLDER 已保留；它可能与 Docker 开发挂载不同，切换模式前须核对文件来源，本入口不搬迁数据"
        fi
        if [ -z "${UPLOAD_FOLDER//[[:space:]]/}" ] || [ -z "${TYPST_PDF_STORAGE_DIR//[[:space:]]/}" ]; then
            print_error "本地上传/PDF 目录不能显式设为空"
            return 1
        fi
        # 特殊字符交给 URL 编码，不把口令原文输出到日志。
        DATABASE_URL="$(python3 -I -c 'import os; from urllib.parse import quote; e=os.environ; print("postgresql+"+e["DATABASE_DRIVER"]+"://"+quote(e["POSTGRES_USER"],safe="")+":"+quote(e["POSTGRES_PASSWORD"],safe="")+"@"+e["POSTGRES_HOST"]+":"+e["POSTGRES_PORT"]+"/"+quote(e["POSTGRES_DB"],safe=""))')" || return 1
        export DATABASE_URL
        export REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}/0"
        export REDIS_CACHE_URL="redis://${REDIS_HOST}:${REDIS_PORT}/1"
        export CELERY_BROKER_URL="${REDIS_URL}" CELERY_RESULT_BACKEND="${REDIS_URL}"
    fi

    set_default_env BACKEND_HOST "0.0.0.0"
    set_default_env BACKEND_PORT "8000"
    set_default_env BACKEND_RELOAD "True"
    set_default_env DEBUG "True"
    set_default_env LOG_LEVEL "INFO"
    set_default_env FRONTEND_PORT "6608"
    set_default_env PORT "${FRONTEND_PORT}"
    if [ "${START_MODE:-local}" = "docker" ]; then
        set_default_env DEV_PROXY_TARGET "http://backend:8000"
    else
        set_default_env DEV_PROXY_TARGET "http://localhost:${BACKEND_PORT}"
    fi
    set_default_env REACT_APP_API_URL "/api/v1"

    if ! ( cd "${PROJECT_ROOT}" && node scripts/check-env-consistency.mjs --startup "${START_MODE:-local}" ); then
        print_error "生效配置检查未通过，启动中止"
        return 1
    fi
    if [ "${START_MODE:-local}" = "local" ]; then
        mkdir -p "${UPLOAD_FOLDER}" "${TYPST_PDF_STORAGE_DIR}"
    fi
    print_success "开发配置检查完成"
}

dev_compose() {
    local -a environment_files=(--env-file "${PROJECT_ROOT}/.env.dev")
    if [ -f "${PROJECT_ROOT}/.env.local" ]; then
        environment_files+=(--env-file "${PROJECT_ROOT}/.env.local")
    fi
    # 文件/项目选择与核验一致，不继承另一终端留下的 Compose 选择器。
    env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_ENV_FILES -u COMPOSE_PROFILES \
        -u COMPOSE_PATH_SEPARATOR -u COMPOSE_PROJECT_DIRECTORY \
        docker compose "${environment_files[@]}" -f "${PROJECT_ROOT}/docker-compose.dev.yml" "$@"
}

check_development_containers() {
    # 只检查归属，不按固定名称 rm；重建由开发 Compose 自己管理。
    node "${PROJECT_ROOT}/scripts/dev-containers.mjs" --root "${PROJECT_ROOT}" check
}

# 函数：启动Docker基础设施
start_docker_infrastructure() {
    check_docker_daemon
    print_info "启动Docker基础设施..."
    
    # 检查Docker是否运行
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker未运行，请先启动Docker"
        exit 1
    fi
    
    # 检查必要的Docker容器（必须精确匹配，避免误判 wangsh-postgres-1 之类的 Compose 容器）
    if ! docker ps --format "{{.Names}}" | grep -qx "wangsh-postgres"; then
        print_info "启动PostgreSQL容器..."
        cd "${PROJECT_ROOT}"
        dev_compose up -d postgres
        
        # 等待数据库就绪
        print_info "等待PostgreSQL就绪..."
        local max_attempts=30
        local attempt=1
        
        while ! docker exec wangsh-postgres \
            pg_isready -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-wangsh_db}" > /dev/null 2>&1; do
            if [ ${attempt} -ge ${max_attempts} ]; then
                print_error "PostgreSQL启动超时"
                exit 1
            fi
            print_info "等待PostgreSQL... (${attempt}/${max_attempts})"
            sleep 2
            ((attempt++))
        done
        print_success "PostgreSQL已就绪"
    else
        print_info "PostgreSQL容器已在运行"
    fi

    print_info "确认PostgreSQL可接受连接..."
    local pg_ready_attempt=1
    local pg_ready_max=30
    while true; do
        if docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" -i wangsh-postgres \
            psql -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-wangsh_db}" -c "SELECT 1;" > /dev/null 2>&1; then
            break
        fi
        if [ ${pg_ready_attempt} -ge ${pg_ready_max} ]; then
            print_error "PostgreSQL连接超时（容器已运行但数据库仍未就绪）"
            exit 1
        fi
        print_info "等待PostgreSQL接受连接... (${pg_ready_attempt}/${pg_ready_max})"
        sleep 2
        ((pg_ready_attempt++))
    done
    print_success "PostgreSQL连接就绪"

    # 数据库迁移由 Alembic 自动处理（backend 启动时运行）
    
    if ! docker ps --format "{{.Names}}" | grep -qx "wangsh-redis"; then
        print_info "启动Redis容器..."
        cd "${PROJECT_ROOT}"
        dev_compose up -d redis
        
        # 等待Redis就绪
        print_info "等待Redis就绪..."
        sleep 3
        print_success "Redis已就绪"
    else
        print_info "Redis容器已在运行"
    fi
    
    # 检查Adminer容器
    if ! docker ps --format "{{.Names}}" | grep -qx "wangsh-adminer"; then
        print_info "启动Adminer数据库管理界面..."
        cd "${PROJECT_ROOT}"
        dev_compose up -d adminer
        sleep 2
        print_success "Adminer已启动，访问: http://localhost:8081"
    else
        print_info "Adminer容器已在运行"
    fi
    
    if [ "${START_MODE:-local}" = "docker" ]; then
        if ! docker ps --format "{{.Names}}" | grep -qx "wangsh-typst-worker"; then
            print_info "启动Typst Worker容器..."
            cd "${PROJECT_ROOT}"
            dev_compose up -d typst-worker
            print_success "Typst Worker已启动"
        else
            print_info "Typst Worker容器已在运行"
        fi

        if ! docker ps --format "{{.Names}}" | grep -qx "wangsh-pythonlab-worker"; then
            # Ensure arm64 sandbox image exists for Apple Silicon dev machines
            local sandbox_image="${PYTHONLAB_SANDBOX_IMAGE:-pythonlab-sandbox:py311-arm64}"
            if ! docker image inspect "${sandbox_image}" > /dev/null 2>&1; then
                print_info "构建 PythonLab sandbox 镜像 (${sandbox_image})..."
                local sandbox_dir="${PROJECT_ROOT}/backend/docker/pythonlab-sandbox"
                if [ -d "${sandbox_dir}" ]; then
                    docker build --platform linux/arm64 \
                        -t "${sandbox_image}" \
                        --build-arg PIP_INDEX_URL="${PIP_INDEX_URL:-https://mirrors.aliyun.com/pypi/simple}" \
                        "${sandbox_dir}"
                    print_success "Sandbox 镜像构建完成: ${sandbox_image}"
                else
                    print_warning "未找到 sandbox Dockerfile: ${sandbox_dir}，跳过构建"
                fi
            fi
            print_info "启动PythonLab Worker容器..."
            cd "${PROJECT_ROOT}"
            dev_compose up -d pythonlab-worker
            print_success "PythonLab Worker已启动"
        else
            print_info "PythonLab Worker容器已在运行"
        fi
    else
        print_info "本地模式跳过 Docker Typst/PythonLab Worker，避免自动拉起 backend 容器占用 8000 端口"
    fi
    
    print_success "Docker基础设施启动完成"
}

start_docker_stack() {
    print_info "启动Docker开发环境服务栈..."
    cd "${PROJECT_ROOT}"
    dev_compose up -d postgres redis adminer backend typst-worker pythonlab-worker frontend

    print_info "等待前端服务就绪..."
    local max_attempts=60
    local attempt=1
    local frontend_port="6608"
    while ! curl -fsS "http://localhost:${frontend_port}" > /dev/null 2>&1; do
        if [ ${attempt} -ge ${max_attempts} ]; then
            print_error "Docker服务栈启动超时（前端未就绪）"
            dev_compose ps
            exit 1
        fi
        print_info "等待入口服务... (${attempt}/${max_attempts})"
        sleep 2
        ((attempt++))
    done
    print_success "Docker开发环境服务栈启动完成"
}

# 函数：启动本地后端服务
start_local_backend() {
    print_info "启动本地后端服务 (FastAPI)..."
    
    # 再次确认端口未被占用（双重检查）
    if ! check_port ${BACKEND_PORT} "后端服务"; then
        print_error "后端端口 ${BACKEND_PORT} 被占用，尝试强制停止..."
        if ! force_stop_port ${BACKEND_PORT} "后端服务"; then
            print_error "无法释放后端端口 ${BACKEND_PORT}，启动失败"
            return 1
        fi
        # 残留的是非 Python 占用（如 Docker Desktop 的端口代理）。
        # 本地后端会绑定失败，真正原因在日志里，不在这里武断退出。
        if lsof -Pi :${BACKEND_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "端口 ${BACKEND_PORT} 仍被非 Python 进程占用，跳过本地后端启动"
            return 1
        fi
    fi
    
    # 检查后端目录
    if [ ! -d "${BACKEND_DIR}" ]; then
        print_error "后端目录不存在: ${BACKEND_DIR}"
        return 1
    fi
    
    # 启动后端服务（后台运行）
    cd "${BACKEND_DIR}"
    print_info "后端日志: ${BACKEND_LOG}"
    
    # API 与 worker 共用同一解释器，不依赖用户预先激活虚拟环境。
    local PYTHON_BIN
    PYTHON_BIN="$(select_backend_python)"
    # 检查Python依赖
    if [ ! -f "${BACKEND_DIR}/requirements.txt" ]; then
        print_warning "未找到 requirements.txt，跳过依赖检查"
    else
        print_info "检查Python依赖..."
        # 依赖已在 backend/venv 准备好；这里只做探测，避免往系统 Python 装包
        "${PYTHON_BIN}" -c "import uvicorn" 2>/dev/null || { print_error "后端解释器缺少 uvicorn，请先安装项目依赖"; return 1; }
    fi
    
    # 启动后端服务（使用正确的环境变量）
    BACKEND_PID="$(spawn_detached_process \
        "${BACKEND_DIR}" \
        "${BACKEND_LOG}" \
        "${PYTHON_BIN}" -m uvicorn main:app \
        --host 0.0.0.0 \
        --port "${BACKEND_PORT}" \
        --reload)"
    print_info "后端服务PID: ${BACKEND_PID}"
    
    # 等待后端启动
    print_info "等待后端服务启动..."
    local max_attempts=30
    local attempt=1
    
    while ! curl -s "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; do
        if [ ${attempt} -ge ${max_attempts} ]; then
            print_error "后端服务启动超时，请查看日志: ${BACKEND_LOG}"
            tail -20 "${BACKEND_LOG}"
            exit 1
        fi
        print_info "等待后端服务... (${attempt}/${max_attempts})"
        sleep 2
        ((attempt++))
    done
    
    # 健康检查已确认端点可用；只核对刚启动的 PID 仍存活，避免用宽泛进程名冒充归属。
    if kill -0 "${BACKEND_PID}" > /dev/null 2>&1; then
        print_success "本地后端服务启动成功 (PID: ${BACKEND_PID})"
    else
        print_error "未检测到本地 uvicorn 进程，后端启动状态异常，请查看日志: ${BACKEND_LOG}"
        tail -20 "${BACKEND_LOG}" || true
        return 1
    fi
    
    if api_docs_enabled; then
        print_info "API文档: http://localhost:${BACKEND_PORT}/docs"
    else
        print_info "API文档已关闭（DEBUG=False）；如需查看，在后端进程的 DEBUG=True 下启动"
    fi
}

select_backend_python() {
    if [ -x "${BACKEND_DIR}/venv/bin/python" ]; then
        printf '%s' "${BACKEND_DIR}/venv/bin/python"
    else
        command -v python3
    fi
}

# 函数：启动本地 Celery Worker（用于 PythonLab debug 会话等异步任务）
start_local_celery_worker() {
    print_info "启动本地Celery Worker..."
    
    # 检查后端目录
    if [ ! -d "${BACKEND_DIR}" ]; then
        print_error "后端目录不存在: ${BACKEND_DIR}"
        return 1
    fi
    
    cd "${BACKEND_DIR}"
    print_info "Celery日志: ${CELERY_LOG}"
    
    local PYTHON_BIN
    PYTHON_BIN="$(select_backend_python)"
    CELERY_PID="$(spawn_detached_process \
        "${BACKEND_DIR}" \
        "${CELERY_LOG}" \
        "${PYTHON_BIN}" -m celery -A app.core.celery_app:celery_app worker \
        -l INFO \
        -c 1 \
        -Q celery,typst \
        --pool=solo)"
    print_info "Celery Worker PID: ${CELERY_PID}"
    
    sleep 2
    if kill -0 "${CELERY_PID}" > /dev/null 2>&1; then
        print_success "本地Celery Worker启动完成 (PID: ${CELERY_PID})"
        return 0
    fi
    
    print_error "Celery Worker 启动失败，请查看日志: ${CELERY_LOG}"
    tail -30 "${CELERY_LOG}" || true
    return 1
}

# 函数：启动本地前端服务
start_local_frontend() {
    print_info "启动本地前端服务 (React)..."
    
    # 再次确认端口未被占用（双重检查）
    if ! check_port ${FRONTEND_PORT} "前端服务"; then
        print_error "前端端口 ${FRONTEND_PORT} 被占用，尝试强制停止..."
        if ! force_stop_port ${FRONTEND_PORT} "前端服务"; then
            print_error "无法释放前端端口 ${FRONTEND_PORT}，启动失败"
            return 1
        fi
    fi
    
    # 检查前端目录
    if [ ! -d "${FRONTEND_DIR}" ]; then
        print_error "前端目录不存在: ${FRONTEND_DIR}"
        return 1
    fi
    
    # 启动前端服务（后台运行）
    cd "${FRONTEND_DIR}"
    print_info "前端日志: ${FRONTEND_LOG}"
    
    # 检查Node.js依赖
    if [ ! -f "${FRONTEND_DIR}/package.json" ]; then
        print_error "未找到 package.json"
        return 1
    fi
    
    # 安装依赖（如果node_modules不存在）
    if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
        print_info "安装前端依赖..."
        npm install --silent
    fi
    
    # 启动前端服务（使用正确的环境变量）
    FRONTEND_PID="$(spawn_detached_process \
        "${FRONTEND_DIR}" \
        "${FRONTEND_LOG}" \
        npm start)"
    print_info "前端服务PID: ${FRONTEND_PID}"
    
    # 等待前端启动
    print_info "等待前端服务启动..."
    local max_attempts=60  # 前端启动较慢，增加等待时间
    local attempt=1
    
    while ! curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}" | grep -q "200"; do
        if [ ${attempt} -ge ${max_attempts} ]; then
            print_error "前端服务启动超时，请查看日志: ${FRONTEND_LOG}"
            tail -20 "${FRONTEND_LOG}"
            exit 1
        fi
        print_info "等待前端服务... (${attempt}/${max_attempts})"
        sleep 2
        ((attempt++))
    done
    
    print_success "本地前端服务启动完成 (PID: ${FRONTEND_PID})"
    print_info "前端页面: http://localhost:${FRONTEND_PORT}"
}

# 函数：显示服务状态
show_service_status() {
    echo ""
    echo "============================================"
    echo "         WANGSH 开发环境启动完成"
    echo "============================================"
    echo ""
    echo "📊 服务状态："
    
    if [ "${START_MODE:-local}" = "docker" ]; then
        if lsof -Pi :6608 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "  ${GREEN}✅ 前端页面:    http://localhost:6608${NC}"
        else
            echo -e "  ${RED}❌ 前端页面:    未运行${NC}"
        fi
        if lsof -Pi :${BACKEND_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "  ${GREEN}✅ 后端API服务: http://localhost:${BACKEND_PORT}${NC}"
        else
            echo -e "  ${RED}❌ 后端API服务: 未运行${NC}"
        fi
    else
        if lsof -Pi :${BACKEND_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "  ${GREEN}✅ 后端API服务: http://localhost:${BACKEND_PORT}${NC}"
        else
            echo -e "  ${RED}❌ 后端API服务: 未运行${NC}"
        fi
        
        if lsof -Pi :${FRONTEND_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "  ${GREEN}✅ 前端页面:    http://localhost:${FRONTEND_PORT}${NC}"
        else
            echo -e "  ${RED}❌ 前端页面:    未运行${NC}"
        fi
    fi
    
    # 检查Docker容器（精确匹配）
    if docker ps --format "{{.Names}}" | grep -qx "wangsh-postgres"; then
        echo -e "  ${GREEN}✅ PostgreSQL: localhost:${POSTGRES_PORT}${NC}"
    else
        echo -e "  ${RED}❌ PostgreSQL: 未运行${NC}"
    fi
    
    if docker ps --format "{{.Names}}" | grep -qx "wangsh-redis"; then
        echo -e "  ${GREEN}✅ Redis:      localhost:${REDIS_PORT}${NC}"
    else
        echo -e "  ${RED}❌ Redis:      未运行${NC}"
    fi
    
    if docker ps --format "{{.Names}}" | grep -qx "wangsh-adminer"; then
        echo -e "  ${GREEN}✅ Adminer:    http://localhost:8081${NC}"
    else
        echo -e "  ${RED}❌ Adminer:    未运行${NC}"
    fi
    
    if [ "${START_MODE:-local}" = "docker" ]; then
        if docker ps --format "{{.Names}}" | grep -qx "wangsh-typst-worker"; then
            echo -e "  ${GREEN}✅ Typst Worker: 运行中${NC}"
        else
            echo -e "  ${RED}❌ Typst Worker: 未运行${NC}"
        fi

        if docker ps --format "{{.Names}}" | grep -qx "wangsh-pythonlab-worker"; then
            echo -e "  ${GREEN}✅ PythonLab:    运行中${NC}"
        else
            echo -e "  ${RED}❌ PythonLab:    未运行${NC}"
        fi
    else
        local worker_pids
        worker_pids="$(dev_processes list --kind worker 2>/dev/null)" || worker_pids=""
        if [ -n "${worker_pids}" ]; then
            echo -e "  ${GREEN}✅ Celery Worker: 本地运行中${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Celery Worker: 未运行（部分异步功能可能不可用）${NC}"
        fi
        echo -e "  ${BLUE}ℹ️  Docker Worker: 本地模式默认跳过 Typst/PythonLab 容器${NC}"
    fi
    
    echo ""
    echo "🔧 开发工具："
    if api_docs_enabled; then
        if [ "${START_MODE:-local}" = "docker" ]; then
            echo "  📚 API文档:      http://localhost:${WEB_PORT:-8080}/docs"
        else
            echo "  📚 API文档:      http://localhost:${BACKEND_PORT}/docs"
        fi
    else
        echo "  📚 API文档:      已关闭（DEBUG=False，/docs 返回 404）"
    fi
    echo "  🗄️  数据库管理:   Adminer: http://localhost:8081 | PSQL: localhost:${POSTGRES_PORT}"
    echo "  🔍 前端热重载:   修改代码后自动刷新"
    echo "  🔄 后端热重载:   修改代码后自动重启"
    echo ""
    echo "👤 测试账户："
    echo "  用户名: admin"
    echo "  密码:   (请查看 .env 或后端配置 SUPER_ADMIN_PASSWORD)"
    echo "  邮箱:   (请查看 .env 或后端配置 SUPER_ADMIN_EMAIL)"
    echo ""
    echo "📋 日志文件："
    echo "  后端日志: ${BACKEND_LOG}"
    echo "  前端日志: ${FRONTEND_LOG}"
    if [ "${START_MODE:-local}" = "local" ]; then
        echo "  Celery日志: ${CELERY_LOG}"
    fi
    echo ""
    echo "🛑 停止服务："
    echo "  运行 ./stop-dev.sh 停止所有服务"
    echo "  运行 ./stop-dev.sh --all 停止所有服务+Docker容器"
    echo ""
    echo "🚀 快速启动："
    echo "  ./start-dev.sh    - 启动所有服务（强制停止占用端口）"
    echo "  ./stop-dev.sh     - 停止所有服务"
    echo ""
    echo "============================================"
}

# 主函数
main() {
    echo ""
    echo "============================================"
    echo "      WangSh 项目统一开发环境启动器 v3.0"
    echo "      增强端口管理，强制停止占用进程"
    echo "============================================"
    echo ""
    
    # 检查必要命令
    print_info "检查系统依赖..."
    check_command docker
    check_docker_daemon
    check_command python3
    check_command node
    check_command npm
    check_command curl
    check_command lsof
    print_success "系统依赖检查完成"
    
    if [ "${1:-}" = "--docker" ]; then
        export START_MODE="docker"
    else
        export START_MODE="local"
    fi

    # 设置环境变量
    setup_environment

    # 两种模式都必须先核实已有容器来源，不能借同名生产库继续启动。
    check_development_containers
    stop_existing_processes
    
    # 启动Docker基础设施
    start_docker_infrastructure

    if [ "${START_MODE}" = "docker" ]; then
        start_docker_stack
    else
        start_local_backend
        if ! start_local_celery_worker; then
            print_warning "本地 Celery Worker 启动失败，Typst/PythonLab 等异步能力可能不可用"
        fi
        start_local_frontend
    fi
    
    # 显示服务状态
    show_service_status
    
    # 提示自动打开浏览器
    print_info "正在打开浏览器..."
    sleep 2
    
    # 尝试打开浏览器
    if command -v open > /dev/null; then
        if [ "${START_MODE}" = "docker" ]; then
            open "http://localhost:6608"
        else
            open "http://localhost:${FRONTEND_PORT}"
        fi
        if api_docs_enabled; then
            open "http://localhost:${BACKEND_PORT}/docs"
        fi
    fi
}

# 执行主函数
main "$@"
