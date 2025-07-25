// image-loader.ts
import type { ImageLoaderProps } from "next/image";

function normalizeSrc(src: string) {
  return src.startsWith("/") ? src.slice(1) : src;
}

export default function cloudflareLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  if (process.env.NODE_ENV === "development") {
    return src;
  }
  const params = [`width=${width}`, "format=auto"];
  if (quality) params.push(`quality=${quality}`);
  const paramsString = params.join(",");
  return `https://voltique-images.russellkmoore.me/cdn-cgi/image/${paramsString}/${normalizeSrc(
    src
  )}`;
}
