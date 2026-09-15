import { showMessage } from "@/lib/toast";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { xbkDataApi } from "@services";

type Filters = { year?: string; term?: string; [key: string]: unknown };
type Row = { sheet:string; row:number; grade:string; class_name:string; student_no:string; name:string; baseline_course?:string|null; target_course?:string|null; action:string };
type Preview = { plan_id:string; preview_token:string; total_rows:number; changed:number; unchanged:number; changed_rows:Row[]; notice?:string };
type Result = { plan_id:string; status:string; changed:number; inserted:number; updated:number };
type Api = {
  previewCourseSelectionWorkbook(p:{file:File;year:string;term:string}):Promise<Preview>;
  confirmCourseSelectionWorkbook(p:{file:File;year:string;term:string;preview_token:string}):Promise<Result>;
};
type DisplayError = { message:string; code?:string; issues:unknown[] };

const api = xbkDataApi as typeof xbkDataApi & Api;
const errorInfo = (e:unknown, fallback:string):DisplayError => {
  const detail=(e as {response?:{data?:{detail?:unknown}};message?:unknown})?.response?.data?.detail;
  if(typeof detail === "string") return {message:detail || fallback,issues:[]};
  if(Array.isArray(detail)) return {message:detail.map(x=>typeof x?.msg==="string"?x.msg:JSON.stringify(x)).join("；")||fallback,issues:detail};
  if(detail && typeof detail === "object") {
    const d=detail as {message?:unknown;code?:unknown;issues?:unknown};
    return {message:typeof d.message==="string"?d.message:fallback,code:typeof d.code==="string"?d.code:undefined,issues:Array.isArray(d.issues)?d.issues:[]};
  }
  const message=(e as {message?:unknown})?.message;
  return {message:typeof message==="string"&&message?message:fallback,issues:[]};
};
const issueText=(issue:unknown,index:number) => {
  if(typeof issue==="string") return issue;
  if(!issue||typeof issue!=="object") return `问题 ${index+1}`;
  const i=issue as Record<string,unknown>;
  const values=[typeof i.sheet==="string"?`工作表 ${i.sheet}`:null,typeof i.row==="number"?`第 ${i.row} 行`:null,typeof i.class_name==="string"?`班级 ${i.class_name}`:null,typeof i.student_no==="string"?`学号 ${i.student_no}`:null,typeof i.course_code==="string"?`课程 ${i.course_code}`:null,typeof i.message==="string"?i.message:null,typeof i.reason==="string"?i.reason:null,Array.isArray(i.errors)?i.errors.join("；"):null].filter(Boolean);
  return values.length?values.join(" · "):JSON.stringify(i);
};
const actionText=(value:string)=>({select:"选择 / 调整",set_unselected:"取消选课",insert:"新增选课",update:"调整课程",delete:"取消选课",no_change:"不变"}[value]||value);
const resultText=(r:Result)=>r.status==="applied"?{title:"选课变更已应用",body:`本次应用 ${r.changed} 项变更，其中新增 ${r.inserted} 项、更新 ${r.updated} 项。`}:r.status==="already_applied"?{title:"该工作簿已应用",body:"服务器确认目标状态已经完整生效，无需重复提交。"}:r.status==="no_changes"?{title:"没有需要应用的变更",body:"工作簿与当前状态一致，未写入任何数据。"}:{title:"工作簿处理完成",body:`服务器返回状态：${r.status}`};

export function XbkCourseSelectionWorkbookModal({open,onCancel,onSuccess,filters}:{open:boolean;onCancel:()=>void;onSuccess:()=>void;filters:Filters}) {
  const [file,setFile]=useState<File|null>(null), [preview,setPreview]=useState<Preview|null>(null), [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState<DisplayError|null>(null), [previewing,setPreviewing]=useState(false), [confirming,setConfirming]=useState(false);
  const [context,setContext]=useState<{file:File;year:string;term:string;token:string}|null>(null);
  const generation=useRef(0), previewRun=useRef(0), confirmRun=useRef(0), previewLock=useRef(false), confirmLock=useRef(false), input=useRef<HTMLInputElement>(null);
  const year=filters.year?.trim()||"", term=filters.term?.trim()||"", hasPeriod=Boolean(year&&term);
  const current=Boolean(preview&&context&&file===context.file&&year===context.year&&term===context.term&&preview.preview_token===context.token);
  const invalidate=()=>{generation.current++;previewRun.current++;confirmRun.current++;previewLock.current=false;confirmLock.current=false;};
  const clear=()=>{setFile(null);setPreview(null);setContext(null);setResult(null);setError(null);setPreviewing(false);setConfirming(false);if(input.current)input.current.value="";};
  useEffect(()=>{invalidate();clear();},[open,year,term]);
  const close=()=>{invalidate();clear();onCancel();};
  const runPreview=async(next:File)=>{
    if(!open)return;
    if(!hasPeriod){const e={message:"请先选择具体的学年和学期",issues:[]};setError(e);showMessage.warning(e.message);return;}
    if(!next.name.toLowerCase().endsWith(".xlsx")){const e={message:"学生选课工作簿仅支持 .xlsx 文件",issues:[]};setError(e);showMessage.warning(e.message);return;}
    const run=++previewRun.current, gen=generation.current;previewLock.current=true;setPreviewing(true);setError(null);
    try {const p=await api.previewCourseSelectionWorkbook({file:next,year,term});if(gen!==generation.current||run!==previewRun.current||!open)return;setPreview(p);setContext({file:next,year,term,token:p.preview_token});}
    catch(e){if(gen!==generation.current||run!==previewRun.current||!open)return;const d=errorInfo(e,"预览失败，请检查工作簿内容、登录状态或网络后重试");setError(d);showMessage.error(d.message);}
    finally{if(gen===generation.current&&run===previewRun.current){previewLock.current=false;setPreviewing(false);}}
  };
  const change=(e:React.ChangeEvent<HTMLInputElement>)=>{const next=e.target.files?.[0]||null;previewRun.current++;confirmRun.current++;previewLock.current=false;confirmLock.current=false;setFile(next);setPreview(null);setContext(null);setResult(null);setError(null);setPreviewing(false);setConfirming(false);if(next)void runPreview(next);};
  const confirm=async()=>{
    if(confirmLock.current||previewLock.current||!open)return;
    if(!file||!preview||!context||!current){const e={message:"工作簿或筛选条件已变化，请重新预览后再确认",issues:[]};setError(e);showMessage.warning(e.message);return;}
    const run=++confirmRun.current,gen=generation.current,p=preview,c=context;confirmLock.current=true;setConfirming(true);setError(null);
    try{const r=await api.confirmCourseSelectionWorkbook({file:c.file,year:c.year,term:c.term,preview_token:c.token});if(gen!==generation.current||run!==confirmRun.current||!open||preview!==p||context!==c)return;setResult(r);showMessage.success(resultText(r).title);onSuccess();}
    catch(e){if(gen!==generation.current||run!==confirmRun.current||!open||preview!==p||context!==c)return;const d=errorInfo(e,"确认失败，服务器未应用任何变更，请重新预览");setError(d);showMessage.error(d.message);}
    finally{if(gen===generation.current&&run===confirmRun.current){confirmLock.current=false;setConfirming(false);}}
  };
  const copy=result?resultText(result):null;
  return <Dialog open={open} onOpenChange={v=>!v&&close()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[920px]">
    <DialogHeader><DialogTitle>导入学生选课工作簿</DialogTitle><DialogDescription>上传当前学年、学期导出的 .xlsx 学生选课表；核对预览后再整批确认。</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-border bg-surface-2 p-4 sm:grid-cols-[160px_160px_1fr]">
        <div><div className="text-xs text-text-tertiary">学年</div><div className="mt-1 text-sm font-medium">{year||"未选择"}</div></div>
        <div><div className="text-xs text-text-tertiary">学期</div><div className="mt-1 text-sm font-medium">{term||"未选择"}</div></div>
        <div><label htmlFor="xbk-r3-file" className="text-xs text-text-tertiary">学生选课工作簿</label><Input ref={input} id="xbk-r3-file" className="mt-1" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={confirming} onChange={change}/></div>
      </div>
      {!hasPeriod&&<Alert variant="warning"><AlertTitle>请选择具体的学年和学期</AlertTitle><AlertDescription>“全部学年”或“全部学期”不能用于工作簿预览和确认。</AlertDescription></Alert>}
      {file&&<div className="flex items-center gap-2 text-sm text-text-secondary"><FileSpreadsheet className="h-4 w-4 text-primary" aria-hidden="true"/><span>{file.name}</span>{previewing&&<span>正在预览…</span>}</div>}
      {error&&<Alert variant="destructive"><AlertTitle>{error.message}</AlertTitle><AlertDescription>{error.code&&<div>错误代码：{error.code}</div>}{error.issues.length>0&&<ul className="mt-2 list-disc pl-5">{error.issues.map((x,i)=><li key={i}>{issueText(x,i)}</li>)}</ul>}</AlertDescription></Alert>}
      {preview&&<section className="space-y-3" aria-labelledby="xbk-r3-preview"><div className="flex flex-wrap items-center justify-between gap-2"><h3 id="xbk-r3-preview" className="text-sm font-semibold">变更预览</h3><div className="flex gap-2 text-sm"><span className="rounded-md bg-primary-soft px-2 py-1 text-primary">变更 {preview.changed}</span><span className="rounded-md bg-surface-2 px-2 py-1">不变 {preview.unchanged}</span><span className="rounded-md bg-surface-2 px-2 py-1">总计 {preview.total_rows}</span></div></div>
        {preview.changed_rows.length?<div className="max-h-[320px] overflow-auto rounded-lg border border-border"><table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 bg-surface-2"><tr>{["班级","学生","原课程","目标课程","动作"].map(x=><th key={x} className="px-3 py-2 font-medium">{x}</th>)}</tr></thead><tbody>{preview.changed_rows.map(r=><tr key={`${r.sheet}-${r.row}-${r.student_no}`} className="border-t border-border"><td className="px-3 py-2">{r.grade}{r.class_name}</td><td className="px-3 py-2"><div>{r.name}</div><div className="text-xs text-text-tertiary">{r.student_no}</div></td><td className="px-3 py-2">{r.baseline_course||"未选"}</td><td className="px-3 py-2">{r.target_course||"未选"}</td><td className="px-3 py-2">{actionText(r.action)}</td></tr>)}</tbody></table></div>:<div className="rounded-lg border border-border bg-surface-2 p-4 text-sm">没有选课变化，仍可由服务器确认当前状态。</div>}
        {preview.notice&&<Alert><AlertTitle>服务器提示</AlertTitle><AlertDescription>{preview.notice}</AlertDescription></Alert>}
      </section>}
      {copy&&<Alert><AlertTitle>{copy.title}</AlertTitle><AlertDescription>{copy.body}</AlertDescription></Alert>}
    </div>
    <DialogFooter><Button variant="outline" onClick={close}>{result?"完成":"取消"}</Button>{file&&!preview&&!previewing&&<Button variant="outline" disabled={!hasPeriod||confirming} onClick={()=>void runPreview(file)}>重新预览</Button>}<Button onClick={confirm} disabled={!current||previewing||confirming||Boolean(result)}>{confirming?<><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true"/>正在确认…</>:"确认应用"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
