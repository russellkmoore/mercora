"use client";

import { useEffect } from "react";

type CustomPageAssetsProps = {
  pageId: number;
  customCss: string | null;
  customJs: string | null;
  customJsEnabled: boolean;
};

export default function CustomPageAssets({
  pageId,
  customCss,
  customJs,
  customJsEnabled,
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
    if (!customJsEnabled || !customJs) return;
    try {
      new Function(customJs)();
    } catch {
      // Stored scripts are isolated from the rendering path. Runtime failures
      // must not take the page down or expose the script/error in logs.
    }
  }, [customJs, customJsEnabled]);

  return null;
}
