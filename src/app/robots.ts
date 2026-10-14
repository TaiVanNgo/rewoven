import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Crawlers must be able to read the page's noindex metadata.
    rules: { userAgent: "*", allow: "/" },
    ...(site.indexable && site.url
      ? { sitemap: new URL("/sitemap.xml", site.url).toString() }
      : {}),
  };
}
