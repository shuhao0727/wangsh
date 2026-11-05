#!/bin/bash
# ============================================
# WangSh 项目本地开发停止脚本
# 版本：3.0.0
# 改进：只停止本项目可识别的开发进程（Python 监听者、本树 Vite），
#       不再按端口无条件 kill，避免误杀 Docker 端口代理和其他项目
# ============================================

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 端口配置
BACKEND_PORT=8000
FRONTEND_PORT=6608

# 项目根目录与前端目录（用于识别本树 Vite 监听者）
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"

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

# 所有信号都经共享归属守卫；无进程为正常结果，查询失败不能冒充成功。
dev_processes() {
    python3 -I -B "${PROJECT_ROOT}/scripts/dev-processes.py" --root "${PROJECT_ROOT}" "$@"
}

# 函数：停止所有本地进程
stop_all_local_processes() {
    print_info "停止已核准的本项目开发进程..."
    if ! dev_processes stop; then
        print_error "部分进程归属或退出状态无法核实，未确认停止成功"
        return 1
    fi
    local port
    for port in "${BACKEND_PORT}" "${FRONTEND_PORT}"; do
        if lsof -Pi :"${port}" -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "端口 ${port} 仍有其他或无法核准的进程，已保留"
        fi
    done
    print_success "已核准的本项目开发进程已停止"
}

# 与启动入口一致：显式选择文件与项目，不继承另一终端留下的 COMPOSE_* 选择器。
stop_dev_compose() {
    local -a env_files=()
    [ -f "${PROJECT_ROOT}/.env.dev" ] && env_files+=(--env-file "${PROJECT_ROOT}/.env.dev")
    [ -f "${PROJECT_ROOT}/.env.local" ] && env_files+=(--env-file "${PROJECT_ROOT}/.env.local")
    env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_ENV_FILES -u COMPOSE_PROFILES \
        -u COMPOSE_PATH_SEPARATOR -u COMPOSE_PROJECT_DIRECTORY \
        docker compose ${env_files[@]+"${env_files[@]}"} -f "${PROJECT_ROOT}/docker-compose.dev.yml" "$@"
}

stop_prod_compose() {
    local -a env_files=()
    [ -f "${PROJECT_ROOT}/.env" ] && env_files+=(--env-file "${PROJECT_ROOT}/.env")
    env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_ENV_FILES -u COMPOSE_PROFILES \
        -u COMPOSE_PATH_SEPARATOR -u COMPOSE_PROJECT_DIRECTORY \
        docker compose ${env_files[@]+"${env_files[@]}"} -f "${PROJECT_ROOT}/docker-compose.yml" "$@"
}

# 函数：停止Docker容器
stop_docker_containers() {
    print_info "停止Docker容器..."

    if ! docker info > /dev/null 2>&1; then
        print_warning "Docker 守护进程未运行，跳过容器停止（请先启动 Docker Desktop 后再执行）"
        return 0
    fi
    
    # 检查项目根目录
    if [ ! -f "${PROJECT_ROOT}/docker-compose.dev.yml" ]; then
        print_error "未找到 docker-compose.dev.yml 文件"
        return 1
    fi
    
    # 停止开发 Docker 容器
    cd "${PROJECT_ROOT}"
    stop_dev_compose down --remove-orphans || true

    # 如存在生产 compose，也一并停止（避免端口冲突）
    if [ -f "${PROJECT_ROOT}/docker-compose.yml" ]; then
        stop_prod_compose down --remove-orphans || true
    fi
    
    # 验证容器是否已停止
    sleep 2
    
    local postgres_stopped=true
    local redis_stopped=true
    
    if docker ps --format "{{.Names}}" | grep -qx "wangsh-postgres"; then
        print_error "❌ PostgreSQL容器仍在运行"
        postgres_stopped=false
    else
        print_success "✅ PostgreSQL容器已停止"
    fi
    
    if docker ps --format "{{.Names}}" | grep -qx "wangsh-redis"; then
        print_error "❌ Redis容器仍在运行"
        redis_stopped=false
    else
        print_success "✅ Redis容器已停止"
    fi
    
    local adminer_stopped=true
    if docker ps --format "{{.Names}}" | grep -qx "wangsh-adminer"; then
        print_error "❌ Adminer容器仍在运行"
        adminer_stopped=false
    else
        print_success "✅ Adminer容器已停止"
    fi

    local typst_stopped=true
    if docker ps --format "{{.Names}}" | grep -qx "wangsh-typst-worker"; then
        print_error "❌ Typst Worker容器仍在运行"
        typst_stopped=false
    else
        print_success "✅ Typst Worker容器已停止"
    fi

    local pythonlab_stopped=true
    if docker ps --format "{{.Names}}" | grep -qx "wangsh-pythonlab-worker"; then
        print_error "❌ PythonLab Worker容器仍在运行"
        pythonlab_stopped=false
    else
        print_success "✅ PythonLab Worker容器已停止"
    fi
    
    if $postgres_stopped && $redis_stopped && $adminer_stopped && $typst_stopped && $pythonlab_stopped; then
        print_success "所有Docker容器已停止"
        return 0
    else
        print_error "部分Docker容器停止失败，请手动检查"
        return 1
    fi
}

# 函数：显示当前状态
show_current_status() {
    echo ""
    echo "============================================"
    echo "           当前服务状态报告"
    echo "============================================"
    echo ""
    
    # 检查后端端口状态
    if lsof -Pi :${BACKEND_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${RED}❌ 后端服务: 端口 ${BACKEND_PORT} 被占用${NC}"
        local backend_pids=$(lsof -ti:${BACKEND_PORT})
        echo "     占用进程PID: $backend_pids"
    else
        echo -e "  ${GREEN}✅ 后端服务: 端口 ${BACKEND_PORT} 空闲${NC}"
    fi
    
    # 检查前端端口状态
    if lsof -Pi :${FRONTEND_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${RED}❌ 前端服务: 端口 ${FRONTEND_PORT} 被占用${NC}"
        local frontend_pids=$(lsof -ti:${FRONTEND_PORT})
        echo "     占用进程PID: $frontend_pids"
    else
        echo -e "  ${GREEN}✅ 前端服务: 端口 ${FRONTEND_PORT} 空闲${NC}"
    fi
    
    # 检查进程状态
    echo ""
    echo "📊 进程状态:"
    
    local backend_pids backend_processes
    backend_pids="$(dev_processes list --kind backend)" || return 1
    backend_processes="$(printf '%s\n' "${backend_pids}" | grep -c '[0-9]' || true)"
    if [ $backend_processes -gt 0 ]; then
        echo -e "  ${RED}❌ 后端进程: $backend_processes 个${NC}"
    else
        echo -e "  ${GREEN}✅ 后端进程: 0 个${NC}"
    fi
    
    local frontend_pids frontend_processes
    frontend_pids="$(dev_processes list --kind frontend)" || return 1
    frontend_processes="$(printf '%s\n' "${frontend_pids}" | grep -c '[0-9]' || true)"
    if [ "${frontend_processes}" -gt 0 ]; then
        echo -e "  ${RED}❌ 前端进程: $frontend_processes 个${NC}"
    else
        echo -e "  ${GREEN}✅ 前端进程: 0 个${NC}"
    fi
    
    # 检查Docker容器状态
    echo ""
    echo "🐳 Docker容器状态:"
    if ! docker info > /dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠️  Docker: 未运行（无法检查容器状态）${NC}"
    else
        if docker ps --format "{{.Names}}" | grep -qx "wangsh-postgres"; then
            echo -e "  ${YELLOW}⚠️  PostgreSQL: 运行中${NC}"
        else
            echo -e "  ${GREEN}✅ PostgreSQL: 已停止${NC}"
        fi
        
        if docker ps --format "{{.Names}}" | grep -qx "wangsh-redis"; then
            echo -e "  ${YELLOW}⚠️  Redis: 运行中${NC}"
        else
            echo -e "  ${GREEN}✅ Redis: 已停止${NC}"
        fi
        
        if docker ps --format "{{.Names}}" | grep -qx "wangsh-adminer"; then
            echo -e "  ${YELLOW}⚠️  Adminer: 运行中${NC}"
        else
            echo -e "  ${GREEN}✅ Adminer: 已停止${NC}"
        fi

        if docker ps --format "{{.Names}}" | grep -qx "wangsh-typst-worker"; then
            echo -e "  ${YELLOW}⚠️  Typst Worker: 运行中${NC}"
        else
            echo -e "  ${GREEN}✅ Typst Worker: 已停止${NC}"
        fi

        if docker ps --format "{{.Names}}" | grep -qx "wangsh-pythonlab-worker"; then
            echo -e "  ${YELLOW}⚠️  PythonLab Worker: 运行中${NC}"
        else
            echo -e "  ${GREEN}✅ PythonLab Worker: 已停止${NC}"
        fi
    fi
    
    echo ""
    echo "============================================"
}

# 函数：显示帮助信息
show_help() {
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  无参数      停止所有本地进程（前端+后端）"
    echo "  --all       停止所有本地进程和Docker容器；同时会停止本机生产 Compose 栈（如存在）"
    echo "  --status    显示当前服务状态"
    echo "  --help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0            # 停止所有本地进程"
    echo "  $0 --all      # 停止所有本地进程和Docker容器（含本机生产 Compose 栈，如存在）"
    echo "  $0 --status   # 显示当前状态"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "============================================"
    echo "     WangSh 项目本地开发环境停止器 v3.0"
    echo "      增强端口管理，确保完全释放"
    echo "============================================"
    
    # 检查必要命令
    if ! command -v lsof &> /dev/null; then
        print_error "命令 'lsof' 未找到，请先安装"
        echo "在macOS上可以使用: brew install lsof"
        exit 1
    fi
    
    # 解析参数
    local stop_docker=false
    local show_status=false
    
    for arg in "$@"; do
        case $arg in
            --all)
                stop_docker=true
                ;;
            --status)
                show_status=true
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "未知参数: $arg"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 显示状态模式
    if $show_status; then
        show_current_status
        exit 0
    fi
    
    # 不能把归属查询失败或残存进程报告成停止成功。
    local failed=0
    if ! stop_all_local_processes; then
        failed=1
    fi
    
    # 停止Docker容器（如果指定了--all参数）
    if $stop_docker; then
        echo ""
        echo "--------------------------------------------"
        echo "          停止Docker容器"
        echo "--------------------------------------------"
        
        if ! stop_docker_containers; then
            print_warning "部分Docker容器停止失败"
            failed=1
        fi
    else
        print_info "跳过Docker容器停止（使用 --all 参数停止Docker容器）"
    fi
    
    # 显示最终状态
    echo ""
    show_current_status || failed=1
    if [ "${failed}" -ne 0 ]; then
        print_error "停止操作未全部完成，请核对未处理项"
        return 1
    fi
    echo ""
    print_success "停止操作完成！"
    echo ""
    print_info "要重新启动服务，请运行: ./start-dev.sh"
    print_info "要查看帮助信息，请运行: $0 --help"
    echo ""
}

# 执行主函数
main "$@"
