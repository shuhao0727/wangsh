export type FlowNodeShape =
  | "start_end"
  | "process"
  | "decision"
  | "io"
  | "connector"
  | "subroutine"
  | "list_op"
  | "dict_op"
  | "str_op"
  | "jump"
  | "collection"
  | "note";

export interface FlowNodeTemplate {
  key: FlowNodeShape;
  title: string;
  description: string;
}
