import { toast } from "sonner";

type MessageArgs = string | { content: string; key?: string; duration?: number };

const normalize = (input: MessageArgs | undefined) => {
  if (typeof input === "string") return { content: input };
  if (!input) return { content: "" };
  return input;
};

const call = (
  level: "success" | "error" | "warning" | "info" | "loading",
  input: MessageArgs | undefined,
) => {
  const payload = normalize(input);
  const options = {
    id: payload.key,
    duration: payload.duration,
  };

  switch (level) {
    case "success":
      return toast.success(payload.content, options);
    case "error":
      return toast.error(payload.content, options);
    case "warning":
      return toast.warning(payload.content, options);
    case "info":
      return toast.message(payload.content, options);
    case "loading":
      return toast.loading(payload.content, options);
  }
};

export const showMessage = {
  success: (input?: MessageArgs) => call("success", input),
  error: (input?: MessageArgs) => call("error", input),
  warning: (input?: MessageArgs) => call("warning", input),
  info: (input?: MessageArgs) => call("info", input),
  loading: (input?: MessageArgs) => call("loading", input),
  destroy: (key?: string) => {
    if (key) {
      toast.dismiss(key);
      return;
    }
    toast.dismiss();
  },
};

