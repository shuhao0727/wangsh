#!/bin/bash
# ============================================
# WangSh 项目统一启动脚本
# 功能：启动本地开发环境（Docker基础设施 + 后端 + 前端）
# 版本：3.0.0
# 改进：强制停止占用端口的进程，更好的端口管理
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"

# 端口配置
BACKEND_PORT=8000
FRONTEND_PORT=6608
POSTGRES_PORT=5432
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

# 函数：检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "命令 '$1' 未找到，请先安装"
        exit 1
    fi
}

check_docker_daemon() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker 守护进程未运行，请先启动 Docker Desktop"
        exit 1
    fi
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

# 函数：强制停止占用指定端口的进程
force_stop_port() {
    local port=$1
    local service=$2
    
    if ! lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_info "${service} 端口 ${port} 未被占用"
        return 0
    fi
    
    print_warning "强制停止占用 ${service} 端口 ${port} 的进程..."
    
    local attempt=1
    local max_attempts=3
    
    while lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; do
        if [ ${attempt} -gt ${max_attempts} ]; then
            break
        fi
        
        local pids=$(lsof -Pi :${port} -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ')
        for pid in $pids; do
            if kill -0 $pid > /dev/null 2>&1; then
                print_info "停止进程 PID: $pid"
                kill -TERM $pid 2>/dev/null || true
            fi
        done
        
        sleep 1
        
        pids=$(lsof -Pi :${port} -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ')
        for pid in $pids; do
            if kill -0 $pid > /dev/null 2>&1; then
                print_warning "进程 $pid 仍在运行，强制终止..."
                kill -KILL $pid 2>/dev/null || true
                sleep 1
            fi
        done
        
        ((attempt++))
    done
    
    # 验证端口是否释放
    sleep 2
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_error "端口 ${port} 仍被占用，请手动检查"
        return 1
    fi
    
    print_success "端口 ${port} 已释放"
    return 0
}

# 函数：停止已存在的本地进程
stop_existing_processes() {
    print_info "检查并停止已存在的本地进程..."

    local ports_to_check=()
    if [ "${START_MODE:-local}" = "docker" ]; then
        ports_to_check=(8080 8081 5432 6379)
    else
        ports_to_check=(${BACKEND_PORT} ${FRONTEND_PORT})
    fi
    
    for p in "${ports_to_check[@]}"; do
        if lsof -Pi :${p} -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "端口 ${p} 被占用，强制停止..."
            if ! force_stop_port ${p} "端口 ${p}"; then
                print_error "无法停止端口 ${p} 占用，请手动解决"
                exit 1
            fi
        fi
    done
    
    # 同时检查并停止已知的进程名（双重保障）
    # 停止后端进程
    if pgrep -f "uvicorn.*main.*app" > /dev/null; then
        print_warning "发现已存在的后端进程，正在停止..."
        pkill -f "uvicorn.*main.*app"
        sleep 2
    fi
    
    # 停止前端进程
    if pgrep -f "react-scripts.*start" > /dev/null; then
        print_warning "发现已存在的前端进程，正在停止..."
        pkill -f "react-scripts.*start"
        sleep 2
    fi

    # 停止 Celery worker（本地模式）
    if pgrep -f "celery.*app\\.core\\.celery_app:celery_app" > /dev/null; then
        print_warning "发现已存在的Celery Worker进程，正在停止..."
        pkill -f "celery.*app\\.core\\.celery_app:celery_app"
        sleep 2
    fi
    
    for p in "${ports_to_check[@]}"; do
        if lsof -Pi :${p} -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_error "端口 ${p} 仍被占用，请手动解决"
            exit 1
        fi
    done
    
    print_success "本地进程清理完成，所有端口已释放"
}

# 函数：处理环境变量（修复.env文件中的shell变量语法）
setup_environment() {
    print_info "设置环境变量..."
    
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        load_env_file "${PROJECT_ROOT}/.env"
    fi
    if [ -f "${PROJECT_ROOT}/.env.local" ]; then
        load_env_file "${PROJECT_ROOT}/.env.local"
    fi

    if [ "${START_MODE:-local}" = "local" ]; then
        if [ "${POSTGRES_HOST:-}" = "postgres" ]; then
            export POSTGRES_HOST="localhost"
        fi
        if [ "${REDIS_HOST:-}" = "redis" ]; then
            export REDIS_HOST="localhost"
        fi
    fi

    set_default_env POSTGRES_HOST "localhost"
    set_default_env POSTGRES_PORT "5432"
    set_default_env POSTGRES_USER "admin"
    set_default_env POSTGRES_DB "wangsh_db"
    set_default_env POSTGRES_PASSWORD "dev_postgres_password"
    set_default_env REDIS_HOST "localhost"
    set_default_env REDIS_PORT "6379"
    set_default_env DEPLOYMENT_ENV "development"
    set_default_env DATABASE_DRIVER "asyncpg"

    if [ -z "${DATABASE_URL+x}" ]; then
        export DATABASE_URL="postgresql+${DATABASE_DRIVER}://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    fi
    if [ -z "${REDIS_URL+x}" ]; then
        export REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}/0"
    fi
    if [ -z "${REDIS_CACHE_URL+x}" ]; then
        export REDIS_CACHE_URL="redis://${REDIS_HOST}:${REDIS_PORT}/1"
    fi
    
    # 后端配置
    set_default_env BACKEND_HOST "0.0.0.0"
    set_default_env BACKEND_PORT "8000"
    set_default_env BACKEND_RELOAD "True"
    set_default_env DEBUG "True"
    set_default_env LOG_LEVEL "INFO"
    set_default_env SECRET_KEY "dev_secret_key_only_for_local"
    set_default_env SUPER_ADMIN_USERNAME "admin"
    set_default_env SUPER_ADMIN_PASSWORD "dev_admin_password"
    
    # 前端配置
    set_default_env FRONTEND_PORT "6608"
    set_default_env PORT "${FRONTEND_PORT}"
    if [ "${START_MODE:-local}" = "docker" ]; then
        set_default_env REACT_APP_API_URL "/api/v1"
    else
        set_default_env REACT_APP_API_URL "http://localhost:${BACKEND_PORT:-8000}/api/v1"
    fi
    set_default_env REACT_APP_ENV "development"
    
    print_success "环境变量设置完成"
}

stop_existing_docker_containers() {
    local names=(
        "wangsh-caddy"
        "wangsh-backend"
        "wangsh-frontend"
        "wangsh-postgres"
        "wangsh-redis"
        "wangsh-celery-worker"
        "wangsh-adminer"
    )

    local any_running=0
    for n in "${names[@]}"; do
        if docker ps --format "{{.Names}}" | grep -qx "${n}"; then
            any_running=1
            break
        fi
    done

    if [ "${any_running}" -eq 0 ]; then
        return 0
    fi

    print_warning "发现已存在的Docker容器，正在停止..."
    for n in "${names[@]}"; do
        docker rm -f "${n}" > /dev/null 2>&1 || true
    done
    sleep 2
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
        docker-compose -f docker-compose.dev.yml up -d postgres
        
        # 等待数据库就绪
        print_info "等待PostgreSQL就绪..."
        local max_attempts=30
        local attempt=1
        
        while ! docker exec wangsh-postgres pg_isready -U "${POSTGRES_USER:-admin}" > /dev/null 2>&1; do
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

    local db_migration_sql="${PROJECT_ROOT}/backend/db/migrations/20260216_local_dev_schema.sql"
    if [ -f "${db_migration_sql}" ]; then
        print_info "执行本地开发数据库迁移..."
        docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" -i wangsh-postgres \
            psql -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-wangsh_db}" \
            < "${db_migration_sql}" > /dev/null
        print_success "本地开发数据库迁移完成"
    fi
    
    if ! docker ps --format "{{.Names}}" | grep -qx "wangsh-redis"; then
        print_info "启动Redis容器..."
        cd "${PROJECT_ROOT}"
        docker-compose -f docker-compose.dev.yml up -d redis
        
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
        docker-compose -f docker-compose.dev.yml up -d adminer
        sleep 2
        print_success "Adminer已启动，访问: http://localhost:8081"
    else
        print_info "Adminer容器已在运行"
    fi
    
    print_success "Docker基础设施启动完成"
}

start_docker_stack() {
    print_info "启动Docker开发环境服务栈..."
    cd "${PROJECT_ROOT}"
    docker-compose -f docker-compose.dev.yml up -d postgres redis adminer backend frontend caddy

    print_info "等待入口服务就绪..."
    local max_attempts=60
    local attempt=1
    while ! curl -fsS "http://localhost:8080/health" > /dev/null 2>&1; do
        if [ ${attempt} -ge ${max_attempts} ]; then
            print_error "Docker服务栈启动超时（入口未就绪）"
            docker-compose -f docker-compose.dev.yml ps
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
    fi
    
    # 检查后端目录
    if [ ! -d "${BACKEND_DIR}" ]; then
        print_error "后端目录不存在: ${BACKEND_DIR}"
        return 1
    fi
    
    # 启动后端服务（后台运行）
    cd "${BACKEND_DIR}"
    print_info "后端日志: ${BACKEND_LOG}"
    
    # 检查Python依赖
    if [ ! -f "${BACKEND_DIR}/requirements.txt" ]; then
        print_warning "未找到 requirements.txt，跳过依赖检查"
    else
        print_info "检查Python依赖..."
        python3 -m pip install -r requirements.txt --quiet
    fi
    
    # 启动后端服务（使用正确的环境变量）
    nohup python3 -m uvicorn main:app \
        --host 0.0.0.0 \
        --port ${BACKEND_PORT} \
        --reload \
        > "${BACKEND_LOG}" 2>&1 &
    
    BACKEND_PID=$!
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
    
    # 验证端口确实被新进程占用
    local current_pid=$(lsof -ti:${BACKEND_PORT})
    if [[ -n "$current_pid" ]] && [[ "$current_pid" == "$BACKEND_PID" ]]; then
        print_success "本地后端服务启动成功 (PID: ${BACKEND_PID})"
    else
        print_warning "后端服务已启动，但端口占用PID与预期不一致"
        print_success "本地后端服务启动完成"
    fi
    
    print_info "API文档: http://localhost:${BACKEND_PORT}/docs"
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
    
    nohup python3 -m celery -A app.core.celery_app:celery_app worker \
        -l INFO \
        -c 1 \
        -Q celery,typst \
        --pool=solo \
        > "${CELERY_LOG}" 2>&1 &
    
    CELERY_PID=$!
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
    nohup npm start \
        > "${FRONTEND_LOG}" 2>&1 &
    
    FRONTEND_PID=$!
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
        if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "  ${GREEN}✅ 入口页面:    http://localhost:8080${NC}"
        else
            echo -e "  ${RED}❌ 入口页面:    未运行${NC}"
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
    
    echo ""
    echo "🔧 开发工具："
    if [ "${START_MODE:-local}" = "docker" ]; then
        echo "  📚 API文档:      http://localhost:8080/docs"
    else
        echo "  📚 API文档:      http://localhost:${BACKEND_PORT}/docs"
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

    if [ "${START_MODE}" = "docker" ]; then
        stop_existing_docker_containers
    fi
    stop_existing_processes
    
    # 启动Docker基础设施
    start_docker_infrastructure

    if [ "${START_MODE}" = "docker" ]; then
        start_docker_stack
    else
        start_local_backend
        start_local_celery_worker
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
            open "http://localhost:8080"
            open "http://localhost:8080/docs"
        else
            open "http://localhost:${FRONTEND_PORT}"
            open "http://localhost:${BACKEND_PORT}/docs"
        fi
    fi
}

# 执行主函数
main "$@"
