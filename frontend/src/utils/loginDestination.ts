/** Resolve only explicit, root-relative redirects; roles never change the default. */
export const resolveLoginDestination = (redirect: string | null): string => {
  const fallback = "/home";
  if (
    !redirect?.startsWith("/") ||
    redirect.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(redirect)
  ) {
    return fallback;
  }

  try {
    // Normalize dot segments before Login performs its existing admin check.
    const base = "https://login.invalid";
    const url = new URL(redirect, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
};
