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

  const defaultId = useMemo(() => {
    try {
      const last = localStorage.getItem(lastExperimentKey);
      if (last && experiments.some((x) => x.id === last)) return last;
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
