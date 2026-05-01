import { useEffect, useState } from "react";

function readIsDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function useDocumentDarkMode() {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setIsDark(readIsDark());
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("storage", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", update);
    };
  }, []);

  return isDark;
}

export default useDocumentDarkMode;
