import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  clearable?: boolean
  onClear?: () => void
}

/**
 * 输入框基础外观类。
 * 只在 clearable 场景下才可能被拆分到 wrapper，非 clearable 调用点结构与样式保持原样。
 */
const INPUT_BASE_CLASS =
  "flex h-[var(--ws-control-height)] w-full rounded-lg border border-border bg-surface-2 px-3 py-2xs text-sm ring-offset-background transition-[border-color,background-color,box-shadow] duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-border hover:bg-surface-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:bg-background focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"

/**
 * 需要跟随 wrapper 走的“布局类”前缀。
 *
 * clearable 为真时会渲染一层 relative wrapper，此时真正作为 flex / grid item 的是
 * wrapper 而不是 <input>，所以 flex-1 / w-* / min-w-* 之类的布局类必须落在 wrapper 上，
 * 否则会退化成本次回归前的表现（输入框缩成浏览器默认宽度）。
 */
const LAYOUT_CLASS_PREFIXES = ["flex-", "grow", "shrink", "basis-", "w-", "min-w-", "max-w-", "self-"]

/** 判断单个 class token 是否为布局类；支持 sm:w-64 这类变体前缀，只看最后一段工具类 */
const isLayoutClass = (token: string): boolean => {
  const base = token.slice(token.lastIndexOf(":") + 1)
  return LAYOUT_CLASS_PREFIXES.some((prefix) => base.startsWith(prefix))
}

/** 把 className 拆成 [布局类, 外观类]，供 clearable 场景分流到 wrapper / input */
const splitInputClassName = (className?: string): [string, string] => {
  if (!className) return ["", ""]
  const layout: string[] = []
  const appearance: string[] = []
  for (const token of className.split(/\s+/)) {
    if (!token) continue
    if (isLayoutClass(token)) {
      layout.push(token)
    } else {
      appearance.push(token)
    }
  }
  return [layout.join(" "), appearance.join(" ")]
}

/** 把 input 的 value / defaultValue 归一化成字符串，用于判断是否显示清除按钮 */
const toValueString = (value: React.ComponentProps<"input">["value"]): string => {
  if (value === undefined || value === null) return ""
  // React 对数组类型的 value 会用逗号拼接，这里保持一致
  if (Array.isArray(value)) return (value as readonly string[]).join(",")
  return String(value)
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, clearable, onClear, value, defaultValue, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Merge refs：把外部 ref 指向真实 <input> 元素
    React.useImperativeHandle(ref, () => inputRef.current!)

    // 受控 / 非受控判定：传了 value 即为受控
    const isControlled = value !== undefined

    // 非受控模式下用 state 跟踪当前值。
    // 原实现用 useMemo 只依赖 props.value，并在渲染期读首渲染时为 null 的 inputRef.current，
    // 导致非受控输入永远认为“没有值”，清除按钮不显示。
    const [uncontrolledValue, setUncontrolledValue] = React.useState(() => toValueString(defaultValue))

    // 只有“非受控 + clearable”才需要跟踪，避免给其余输入框增加无谓的状态与渲染
    React.useEffect(() => {
      if (isControlled || !clearable) return
      const el = inputRef.current
      if (!el) return
      // 挂载后以 DOM 实际值为准（defaultValue 可能被浏览器或外部脚本改写）
      setUncontrolledValue(el.value)
      // 监听原生 input 事件：用户输入、程序化写值、清除按钮派发的事件都能覆盖
      const handleNativeInput = () => setUncontrolledValue(el.value)
      el.addEventListener("input", handleNativeInput)
      return () => el.removeEventListener("input", handleNativeInput)
    }, [isControlled, clearable])

    // 当前值：受控取 props.value，非受控取内部跟踪值
    const hasValue = (isControlled ? toValueString(value) : uncontrolledValue) !== ""
    const showClear = clearable === true && hasValue

    const handleClear = () => {
      if (inputRef.current) {
        // Create a native input event
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set
        nativeInputValueSetter?.call(inputRef.current, "")

        const event = new Event("input", { bubbles: true })
        inputRef.current.dispatchEvent(event)
      }

      // Call user's onClear callback
      onClear?.()

      // Keep focus on input
      inputRef.current?.focus()
    }

    // clearable 时把布局类摘出来给 wrapper；非 clearable 不拆分，className 原样透传
    const [layoutClassName, appearanceClassName] = React.useMemo(
      () => (clearable ? splitInputClassName(className) : ["", className ?? ""]),
      [clearable, className]
    )

    const inputElement = (
      <input
        type={type}
        className={cn(
          INPUT_BASE_CLASS,
          appearanceClassName,
          // pr-9 必须排在 appearanceClassName 之后：tailwind-merge 是「后者覆盖前者」，
          // 调用方 className 里常见的 px-3 会把先出现的 pr-9 整个吃掉，
          // 导致末尾文字压到清除按钮底下。放最后才能保证清除按钮的右侧留白生效。
          showClear && "pr-9"
        )}
        ref={inputRef}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
    )

    // 非 clearable：直接返回裸 <input>，DOM 结构与本组件支持 clearable 之前完全一致，
    // 因此调用方传的 flex-1 / w-* 等布局类仍然作用在真正的 flex item 上。
    if (!clearable) {
      return inputElement
    }

    // clearable：需要一层 relative wrapper 承载绝对定位的清除按钮，
    // 布局类落在 wrapper 上，外观类留在 <input> 上。
    return (
      <div className={cn("relative", layoutClassName)}>
        {inputElement}
        {showClear && (
          <button
            type="button"
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2",
              "flex h-5 w-5 items-center justify-center",
              "text-muted-foreground hover:text-foreground",
              "transition-colors duration-150",
              "rounded-sm hover:bg-muted/50"
            )}
            onClick={handleClear}
            onMouseDown={(e) => {
              // Prevent input from losing focus
              e.preventDefault()
            }}
            tabIndex={-1}
            aria-label="Clear input"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
