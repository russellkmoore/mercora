"use client";

import { useEffect } from "react";

type CustomPageAssetsProps = {
  pageId: number;
  customCss: string | null;
  customJsPath: string | null;
};

export default function CustomPageAssets({
  pageId,
  customCss,
  customJsPath,
}: CustomPageAssetsProps) {
  useEffect(() => {
    if (!customCss) return;
    const style = document.createElement("style");
    style.id = `page-${pageId}-styles`;
    style.textContent = customCss;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [customCss, pageId]);

  useEffect(() => {
    if (!customJsPath) return;
    const script = document.createElement("script");
    script.id = `page-${pageId}-script`;
    script.src = customJsPath;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [customJsPath, pageId]);

  return null;
}
