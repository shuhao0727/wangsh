import React, { useEffect, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import PythonLabStudio from "../Admin/ITTechnology/pythonLab/PythonLabStudio";
import { loadPythonLabExperiments } from "../Admin/ITTechnology/pythonLab/storage";

const lastExperimentKey = "python_lab_last_experiment_id";

const PythonLabPage: React.FC = () => {
  const params = useParams();
  const experiments = useMemo(() => loadPythonLabExperiments(), []);
  const id = params.id ? String(params.id) : "";
  const exp = id ? experiments.find((x) => x.id === id) ?? null : null;

  // 决定进入页面时默认打开哪个实验，优先级：用户上次打开的 > 入门默认 > 列表第一个。
  //
  // 注意顺序不能颠倒：loadPythonLabExperiments() 会把内置实验合并进结果，
  // 其中就包含 seq_basic，所以「是否存在 seq_basic」恒为真。
  // 若把 seq_basic 的判断放在最前面直接 return，下面的 localStorage 分支永远不会执行，
  // 就成了「写了但不读」——用户手选实验后刷新会被静默改回顺序结构。
  const defaultId = useMemo(() => {
    try {
      const last = localStorage.getItem(lastExperimentKey);
      if (last && experiments.some((x) => x.id === last)) return last;
      const fixed = "seq_basic";
      if (experiments.some((x) => x.id === fixed)) return fixed;
    } catch {}
    return experiments[0]?.id ?? "";
  }, [experiments]);

  useEffect(() => {
    if (!exp) return;
    try {
      localStorage.setItem(lastExperimentKey, exp.id);
    } catch {}
  }, [exp]);

  if (!id && defaultId) {
    return <Navigate to={`/it-technology/python-lab/${defaultId}`} replace />;
  }
  if (id && !exp && defaultId) {
    return <Navigate to={`/it-technology/python-lab/${defaultId}`} replace />;
  }
  if (!exp) return null;

  return <PythonLabStudio experiment={exp} />;
};

export default PythonLabPage;
