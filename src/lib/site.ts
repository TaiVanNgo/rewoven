function getSiteUrl(): URL | undefined {
  const value = process.env.SITE_URL?.trim();

  if (!value) return undefined;

  const url = new URL(value);

  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "SITE_URL must be an HTTP(S) origin, such as https://your-domain.com.",
    );
  }

  return url;
}

const url = getSiteUrl();
const indexingEnabled = process.env.SITE_INDEXABLE === "true";

if (indexingEnabled && !url) {
  throw new Error("Set SITE_URL before enabling SITE_INDEXABLE.");
}

// Replace the identity fields when creating a project from this starter.
export const site = {
  name: "Your project",
  description: "Replace this with a short description of your project.",
  language: "en",
  locale: "en_US",
  url,
  indexable:
    indexingEnabled &&
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview",
};
