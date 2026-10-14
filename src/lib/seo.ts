import type { Metadata } from "next";
import { site } from "@/lib/site";

type PageMetadata = {
  path: `/${string}`;
  title?: string;
  description?: string;
};

export function createPageMetadata({
  path,
  title,
  description = site.description,
}: PageMetadata): Metadata {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\?#]/.test(path)) {
    throw new Error(
      "SEO paths must be site-relative paths without a query or fragment.",
    );
  }

  const canonical = site.url ? new URL(path, site.url).toString() : undefined;
  const socialTitle = title ? `${title} | ${site.name}` : site.name;

  return {
    ...(title ? { title } : {}),
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: site.locale,
      title: socialTitle,
      description,
      ...(canonical ? { url: canonical } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
  };
}
