import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Add public routes here as the project grows; derive dynamic routes from real data.
const publicPaths = ["/", "/case-library", "/saved-plans"];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = site.url;

  if (!site.indexable || !siteUrl) return [];

  return publicPaths.map((path) => ({
    url: new URL(path, siteUrl).toString(),
  }));
}
