import { useEffect, useState } from "react";

type BreakpointState = {
  xs: boolean;
  sm: boolean;
  md: boolean;
  lg: boolean;
  xl: boolean;
  xxl: boolean;
};

const getState = (): BreakpointState => {
  if (typeof window === "undefined") {
    return {
      xs: false,
      sm: true,
      md: true,
      lg: true,
      xl: true,
      xxl: true,
    };
  }

  const width = window.innerWidth;
  return {
    xs: width < 576,
    sm: width >= 576,
    md: width >= 768,
    lg: width >= 992,
    xl: width >= 1200,
    xxl: width >= 1600,
  };
};

export const useBreakpoint = () => {
  const [screens, setScreens] = useState<BreakpointState>(getState);

  useEffect(() => {
    const onResize = () => {
      setScreens(getState());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return screens;
};

