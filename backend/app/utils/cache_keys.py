"""Pure cache-key formatting shared by the compatibility cache facade."""

def cache_key_generator(
    prefix: str,
    **kwargs
) -> str:
    """生成缓存键（优化版）"""
    if not kwargs:
        return prefix

    # 将布尔值转换为数字
    processed_kwargs = {}
    for key, value in kwargs.items():
        if isinstance(value, bool):
            processed_kwargs[key] = 1 if value else 0
        elif value is None:
            processed_kwargs[key] = 0  # 将None转换为0
        else:
            processed_kwargs[key] = value

    # 使用固定顺序的键，避免排序开销
    # 注意：调用方需要按固定顺序传递参数
    param_str = ":".join(str(processed_kwargs[key]) for key in sorted(kwargs.keys()))
    return f"{prefix}:{param_str}"


def compact_cache_key_generator(
    prefix: str,
    *args
) -> str:
    """紧凑版缓存键生成器（直接传递参数值）"""
    if not args:
        return prefix

    param_str = ":".join(str(arg) for arg in args)
    return f"{prefix}:{param_str}"


class AnalysisCacheKeys:
    """分析相关缓存键生成器"""

    @staticmethod
    def hot_analysis_detail(analysis_id: int) -> str:
        """热点问题分析详情缓存键"""
        return f"analysis:hot:{analysis_id}"

    @staticmethod
    def chain_analysis_detail(analysis_id: int) -> str:
        """学生问题链分析详情缓存键"""
        return f"analysis:chain:{analysis_id}"

    @staticmethod
    def task_analysis_detail(analysis_id: int) -> str:
        """任务分析详情缓存键"""
        return f"analysis:task:{analysis_id}"

    @staticmethod
    def hot_analysis_list(skip: int = 0, limit: int = 50) -> str:
        """热点问题分析列表缓存键"""
        return f"analysis:hot:list:{skip}:{limit}"

    @staticmethod
    def chain_analysis_list(skip: int = 0, limit: int = 50) -> str:
        """学生问题链分析列表缓存键"""
        return f"analysis:chain:list:{skip}:{limit}"

    @staticmethod
    def task_analysis_list(skip: int = 0, limit: int = 20) -> str:
        """任务分析列表缓存键"""
        return f"analysis:task:list:{skip}:{limit}"

    @staticmethod
    def trends_summary(agent_id: int, analysis_type: str, limit: int = 10) -> str:
        """趋势摘要缓存键"""
        return f"analysis:trends:{agent_id}:{analysis_type}:{limit}"
