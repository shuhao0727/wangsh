"""
Flow AST 转换模块

包含将 IR 转换为流程图节点的核心逻辑。
"""

import ast
from typing import Any, Dict, List, Optional, Tuple

from app.api.pythonlab.structured_ir import (
    IRAction,
    IRBlock,
    IRBreak,
    IRClass,
    IRContinue,
    IRForEach,
    IRForRange,
    IRFunction,
    IRIf,
    IRImport,
    IRReturn,
    IRStmt,
    IRTry,
    IRWhile,
)
from app.api.pythonlab.utils import make_edge

from .build_ctx import _BuildCtx
from .utils import (
    _header_title,
    _kind_of,
    _make_node,
    _mark_synthetic,
    _pend,
    _split_pend,
    _teaching_action_title,
    _teaching_condition_title,
)


def _lower_block(ctx: _BuildCtx, block: IRBlock, parent_id: Optional[str], loop_header_stack: List[str]) -> Tuple[Optional[str], List[Tuple[str, str, Optional[str]]]]:
    entry: Optional[str] = None
    pend: List[Tuple[str, str, Optional[str]]] = []
    for s in block.stmts or []:
        sid, s_pend = _lower_stmt(ctx, s, parent_id, loop_header_stack)
        if sid is None:
            if not ctx.truncated:
                continue
            collapsed = _make_node(ctx.code, "CollapsedBlock", getattr(s, "node", None), parent_id, title="已折叠：后续语句")
            cid = ctx.add_node(collapsed)
            if cid is None:
                return entry, pend
            if entry is None:
                entry = cid
            for (from_id, kind, label) in pend:
                if kind == "Next":
                    ctx.add_edge(make_edge("Next", from_id, cid))
                elif kind == "False":
                    ctx.add_edge(make_edge("False", from_id, cid, "否"))
            return entry, [_pend(cid, "Next", None)]
        if entry is None:
            entry = sid
            pend = s_pend
            continue
        for (from_id, kind, label) in pend:
            if kind == "Next":
                ctx.add_edge(make_edge("Next", from_id, sid, label))
            elif kind == "False":
                ctx.add_edge(make_edge("False", from_id, sid, "否"))
            elif kind == "Return":
                ctx.add_edge(make_edge("Return", from_id, sid, "返回"))
        pend = s_pend
    return entry, pend


def _lower_stmt(ctx: _BuildCtx, stmt: IRStmt, parent_id: Optional[str], loop_header_stack: List[str]) -> Tuple[Optional[str], List[Tuple[str, str, Optional[str]]]]:
    if isinstance(stmt, IRClass):
        head_id = ctx.add_node(_make_node(ctx.code, "Start", stmt.node, parent_id, title=f"定义类：{stmt.name}"))
        if not head_id:
            return None, []

        # Class body is executed on definition
        body_entry, body_pend = _lower_block(ctx, stmt.body, head_id, loop_header_stack)

        if body_entry:
            ctx.add_edge(make_edge("Entry", head_id, body_entry, "定义"))

        end_id = ctx.add_node(_make_node(ctx.code, "End", stmt.node, head_id, title="类定义结束"))
        if end_id:
            # Connect all body exits to End Class
            for (from_id, k, label) in body_pend:
                if k == "Next":
                    ctx.add_edge(make_edge("Next", from_id, end_id, label))
                elif k == "Return":
                    # Class body return? Rare, but semantically "end of body"
                    ctx.add_edge(make_edge("Next", from_id, end_id, "结束"))
                # Break/Continue in class body? Invalid syntax usually, but handle gracefully

        return head_id, [_pend(end_id or head_id, "Next", None)]

    if isinstance(stmt, IRImport):
        # Flatten names
        title = ""
        if stmt.from_module:
            title = f"导入：from {stmt.from_module} import {', '.join(stmt.names)}"
        else:
            title = f"导入：import {', '.join(stmt.names)}"

        nid = ctx.add_node(_make_node(ctx.code, "Process", stmt.node, parent_id, title=title))
        return nid, [_pend(nid, "Next", None)] if nid else (None, [])

    if isinstance(stmt, IRAction):
        # Check for I/O semantic mapping
        kind = stmt.kind
        title = _teaching_action_title(kind, stmt.text)

        # Check for print() -> Output
        # ... (Existing I/O logic)

        # Check for List/Dict operations
        # Inspect the AST node
        target_node = stmt.node
        if isinstance(target_node, ast.Expr):
            target_node = target_node.value
        elif isinstance(target_node, ast.Assign):
            target_node = target_node.value

        if isinstance(target_node, ast.Call) and isinstance(target_node.func, ast.Attribute):
            method_name = target_node.func.attr
            if method_name in {"append", "insert", "remove", "sort", "reverse", "extend", "clear"}:
                kind = "list_op"
            elif method_name in {"get", "keys", "values", "items", "update"}:
                kind = "dict_op"
            elif method_name == "pop":
                # ambiguous, default to list_op for now or generic process
                kind = "list_op"
            elif method_name in {"split", "strip", "lstrip", "rstrip", "upper", "lower",
                                  "replace", "join", "find", "rfind", "startswith", "endswith",
                                  "format", "count", "index", "title", "capitalize", "swapcase",
                                  "center", "ljust", "rjust", "zfill", "encode", "decode"}:
                kind = "str_op"

        # Check for print() -> Output (Re-apply existing logic with kind override check)
        if isinstance(stmt.node, ast.Expr) and isinstance(stmt.node.value, ast.Call):
            call = stmt.node.value
            if isinstance(call.func, ast.Name) and call.func.id == "print":
                kind = "Output"
            elif isinstance(call.func, ast.Name) and call.func.id == "input":
                kind = "Input"
            elif isinstance(call.func, ast.Name) and kind not in ("list_op", "dict_op", "str_op"):
                kind = "Subprocess"

        if isinstance(stmt.node, ast.Assign) and isinstance(stmt.node.value, ast.Call):
            call = stmt.node.value
            if isinstance(call.func, ast.Name) and call.func.id == "input":
                kind = "Input"

        nid = ctx.add_node(_make_node(ctx.code, kind, stmt.node, parent_id, title=title))
        return nid, [_pend(nid, "Next", None)] if nid else (None, [])

    if isinstance(stmt, IRReturn):
        title = "return" if not stmt.expr else f"return {stmt.expr}"
        nid = ctx.add_node(_make_node(ctx.code, "Return", stmt.node, parent_id, title=title))
        return nid, [_pend(nid, "Return", None)] if nid else (None, [])

    if isinstance(stmt, IRBreak):
        nid = ctx.add_node(_make_node(ctx.code, "Break", stmt.node, parent_id, title="break"))
        if not nid:
            return None, []
        if loop_header_stack:
            return nid, [_pend(nid, "Break", None)]
        ctx.diagnostics.append({"level": "warn", "code": "W_BREAK_OUTSIDE_LOOP", "message": "break 出现在循环外"})
        return nid, []

    if isinstance(stmt, IRContinue):
        nid = ctx.add_node(_make_node(ctx.code, "Continue", stmt.node, parent_id, title="continue"))
        if not nid:
            return None, []
        if loop_header_stack:
            return nid, [_pend(nid, "Continue", None)]
        ctx.diagnostics.append({"level": "warn", "code": "W_CONTINUE_OUTSIDE_LOOP", "message": "continue 出现在循环外"})
        return nid, []

    if isinstance(stmt, IRIf):
        head_id = ctx.add_node(_make_node(ctx.code, "If", stmt.node, parent_id, title=_teaching_condition_title("判断", stmt.cond, "条件表达式")))
        if not head_id:
            return None, []
        then_entry, then_pend = _lower_block(ctx, stmt.then_block, parent_id, loop_header_stack)
        if then_entry:
            ctx.add_edge(make_edge("True", head_id, then_entry, "是"))
        pend: List[Tuple[str, str, Optional[str]]] = []
        pend.extend(then_pend or [])

        cur_false_from = head_id
        for (cond, blk, elif_node) in stmt.elifs:
            elif_id = ctx.add_node(_make_node(ctx.code, "Elif", elif_node, parent_id, title=_teaching_condition_title("否则判断", cond, "条件表达式")))
            if not elif_id:
                break
            ctx.add_edge(make_edge("False", cur_false_from, elif_id, "否"))
            e_entry, e_pend = _lower_block(ctx, blk, parent_id, loop_header_stack)
            if e_entry:
                ctx.add_edge(make_edge("True", elif_id, e_entry, "是"))
            pend.extend(e_pend or [])
            cur_false_from = elif_id

        if stmt.else_block is not None:
            else_entry, else_pend = _lower_block(ctx, stmt.else_block, parent_id, loop_header_stack)
            if else_entry:
                ctx.add_edge(make_edge("False", cur_false_from, else_entry, "否"))
                pend.extend(else_pend or [])
            else:
                pend.append(_pend(cur_false_from, "False", None))
        else:
            pend.append(_pend(cur_false_from, "False", None))

        if not pend:
            pend = [_pend(head_id, "Next", None)]
        return head_id, pend

    if isinstance(stmt, IRWhile):
        loop_id = ctx.add_node(_make_node(ctx.code, "While", stmt.node, parent_id, title=_teaching_condition_title("循环", stmt.cond, "循环条件")))
        if not loop_id:
            return None, []
        loop_header_stack.append(loop_id)
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        loop_header_stack.pop()
        if body_entry:
            ctx.add_edge(make_edge("True", loop_id, body_entry, "是"))
        pend_map = _split_pend(body_pend)
        for (from_id, _k, _label) in (pend_map.get("Next") or []):
            ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        for (from_id, _k, _label) in (pend_map.get("Continue") or []):
            ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        out: List[Tuple[str, str, Optional[str]]] = []
        for (from_id, _k, _label) in (pend_map.get("Break") or []):
            out.append(_pend(from_id, "Next", "跳出"))
        for (from_id, _k, _label) in (pend_map.get("Return") or []):
            out.append(_pend(from_id, "Return", None))
        out.append(_pend(loop_id, "False", None))
        return loop_id, out

    if isinstance(stmt, IRForRange):
        if str(stmt.step).strip() == "1":
            iter_expr = f"range({stmt.start}, {stmt.stop})"
        else:
            iter_expr = f"range({stmt.start}, {stmt.stop}, {stmt.step})"
        # 区间风格：所有 range 都拆分为 初始化 → 条件(区间) → 循环体 → 递增
        step_text = str(stmt.step).strip()
        step_num = int(step_text) if step_text.lstrip("-").isdigit() else None
        is_neg = step_num is not None and step_num < 0
        step_annotation = "" if step_text in ("1", "-1") else f", 步长={step_text}"
        init_title = f"{stmt.var} = {stmt.start}"
        if is_neg:
            cond_title = f"{stmt.var} ∈ ({stmt.stop}, {stmt.start}]{step_annotation}?"
        else:
            cond_title = f"{stmt.var} ∈ [{stmt.start}, {stmt.stop}){step_annotation}?"
        if step_text == "1":
            inc_title = f"{stmt.var} += 1"
        elif step_text == "-1":
            inc_title = f"{stmt.var} -= 1"
        elif step_num is not None and step_num < 0:
            inc_title = f"{stmt.var} -= {abs(step_num)}"
        else:
            inc_title = f"{stmt.var} += {step_text}"
        init_id = ctx.add_node(
            _make_node(ctx.code, "ForInit", stmt.node, parent_id, title=init_title)
        )
        loop_id = ctx.add_node(_make_node(ctx.code, "For", stmt.node, parent_id, title=cond_title))
        _mark_synthetic(ctx, init_id)
        if not loop_id:
            return None, []
        if init_id:
            ctx.add_edge(make_edge("Next", init_id, loop_id))
        loop_header_stack.append(loop_id)
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        loop_header_stack.pop()
        inc_id = ctx.add_node(
            _make_node(ctx.code, "ForStep", stmt.node, parent_id, title=inc_title)
        )
        _mark_synthetic(ctx, inc_id)
        if body_entry:
            ctx.add_edge(make_edge("True", loop_id, body_entry, "是"))
        pend_map = _split_pend(body_pend)
        for (from_id, _k, _label) in (pend_map.get("Next") or []):
            if inc_id:
                ctx.add_edge(make_edge("Next", from_id, inc_id))
            else:
                ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        for (from_id, _k, _label) in (pend_map.get("Continue") or []):
            if inc_id:
                ctx.add_edge(make_edge("Next", from_id, inc_id))
            else:
                ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        if inc_id:
            ctx.add_edge(make_edge("Back", inc_id, loop_id, "回边"))
        out: List[Tuple[str, str, Optional[str]]] = []
        for (from_id, _k, _label) in (pend_map.get("Break") or []):
            out.append(_pend(from_id, "Next", "跳出"))
        for (from_id, _k, _label) in (pend_map.get("Return") or []):
            out.append(_pend(from_id, "Return", None))
        out.append(_pend(loop_id, "False", None))
        return (init_id or loop_id), out

    if isinstance(stmt, IRForEach):
        cond_title = f"{stmt.iter_expr} 未遍历完?"
        loop_id = ctx.add_node(_make_node(ctx.code, "ForEach", stmt.node, parent_id, title=cond_title))
        next_id = ctx.add_node(_make_node(ctx.code, "ForEachNext", stmt.node, parent_id, title=f"{stmt.var} = 当前元素"))
        _mark_synthetic(ctx, next_id)
        if not loop_id:
            return None, []
        if next_id:
            ctx.add_edge(make_edge("True", loop_id, next_id, "是"))
        loop_header_stack.append(loop_id)
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        loop_header_stack.pop()
        if next_id and body_entry:
            ctx.add_edge(make_edge("Next", next_id, body_entry))
        pend_map = _split_pend(body_pend)
        for (from_id, _k, _label) in (pend_map.get("Next") or []):
            ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        for (from_id, _k, _label) in (pend_map.get("Continue") or []):
            ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        out: List[Tuple[str, str, Optional[str]]] = []
        for (from_id, _k, _label) in (pend_map.get("Break") or []):
            out.append(_pend(from_id, "Next", "跳出"))
        for (from_id, _k, _label) in (pend_map.get("Return") or []):
            out.append(_pend(from_id, "Return", None))
        out.append(_pend(loop_id, "False", None))
        return loop_id, out

    if isinstance(stmt, IRTry):
        head_id = ctx.add_node(_make_node(ctx.code, "Try", stmt.node, parent_id, title="尝试执行"))
        if not head_id:
            return None, []

        # Try Body
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        if body_entry:
            ctx.add_edge(make_edge("Next", head_id, body_entry))

        # Collect all exits from body
        # Normal exits go to Orelse (if present) or Finally (if present) or Next
        # Exception exits go to Handlers

        # In this simplified visualization, we connect body ends to Finally or Next
        # And we implicitly link Try head to Handlers (as if catching from head)
        # This is a visualization compromise. A true CFG would link every statement in body to handlers.

        pend: List[Tuple[str, str, Optional[str]]] = []

        # Link handlers
        for (typ, handler_block) in stmt.handlers:
            h_id = ctx.add_node(_make_node(ctx.code, "Except", stmt.node, parent_id, title=f"捕获异常：{typ}"))
            if h_id:
                ctx.add_edge(make_edge("Exception", head_id, h_id, "异常"))
                h_entry, h_pend = _lower_block(ctx, handler_block, parent_id, loop_header_stack)
                if h_entry:
                    ctx.add_edge(make_edge("Next", h_id, h_entry))
                pend.extend(h_pend or [])

        # Process Body pendings
        # If we have else/finally, flow goes there.
        target_after_body = None
        if stmt.orelse:
            # If we have else block, normal execution goes there
            else_entry, else_pend = _lower_block(ctx, stmt.orelse, parent_id, loop_header_stack)
            if else_entry:
                # All 'Next' from body go to else_entry
                for (from_id, k, label) in body_pend:
                    if k == "Next":
                        ctx.add_edge(make_edge("Next", from_id, else_entry, label))
                    else:
                        pend.append((from_id, k, label))
                pend.extend(else_pend or [])
            else:
                pend.extend(body_pend or [])
        else:
            pend.extend(body_pend or [])

        # Finally block
        if stmt.finalbody:
            fin_entry, fin_pend = _lower_block(ctx, stmt.finalbody, parent_id, loop_header_stack)
            if fin_entry:
                # All pending 'Next' from above (body+else+handlers) go to finally
                # Note: Break/Return/Continue also execute finally, but visualizing that is hard.
                # We usually just link Next.
                new_pend: List[Tuple[str, str, Optional[str]]] = []
                for (from_id, k, label) in pend:
                    if k == "Next":
                        ctx.add_edge(make_edge("Next", from_id, fin_entry, label))
                    else:
                        new_pend.append((from_id, k, label))
                pend = new_pend
                pend.extend(fin_pend or [])

        return head_id, pend

    nid = ctx.add_node(_make_node(ctx.code, "Stmt", getattr(stmt, "node", None), parent_id))
    return nid, [_pend(nid, "Next", None)] if nid else (None, [])