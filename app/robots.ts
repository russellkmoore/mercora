import type { MetadataRoute } from "next";
import { getStoreConfig } from "@/lib/store-config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const config = getStoreConfig();
  const disallow = ["/admin/", "/api/", "/_next/", "/data/"];

  return {
    rules: config.deployment.indexable
      ? { userAgent: "*", allow: "/", disallow }
      : { userAgent: "*", disallow: ["/"] },
    sitemap: config.deployment.indexable ? `${config.urls.site}/sitemap.xml` : undefined,
  };
}
