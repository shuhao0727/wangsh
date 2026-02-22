export type PythonLabLevel = "入门" | "基础" | "进阶";

export type PythonLabScenario =
  | "循环"
  | "条件分支"
  | "函数调用"
  | "异常处理"
  | "递归"
  | "并发"
  | "I/O"
  | "数据结构"
  | "算法"
  | "面向对象";

export interface PythonLabExperiment {
  id: string;
  title: string;
  level: PythonLabLevel;
  tags: string[];
  scenario: PythonLabScenario;
  starterCode: string;
}

export type FlowNodeShape = "start_end" | "process" | "decision" | "io" | "connector" | "subroutine";

export interface FlowNodeTemplate {
  key: FlowNodeShape;
  title: string;
  description: string;
}
