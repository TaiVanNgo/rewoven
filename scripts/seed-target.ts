export function seedTarget(
  production: boolean,
  env: Record<string, string | undefined> = process.env,
) {
  const url = env.SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret?.trim())
    throw new Error("Configure SUPABASE_URL and SUPABASE_SECRET_KEY first.");

  const target = new URL(url);
  if (production) {
    if (
      env.VERCEL !== "1" ||
      env.VERCEL_ENV !== "production" ||
      env.SEED_SAMPLE_CASES !== "true"
    )
      throw new Error(
        "Hosted samples require Vercel Production and SEED_SAMPLE_CASES=true.",
      );
    if (env.VERCEL_GIT_COMMIT_REF && env.VERCEL_GIT_COMMIT_REF !== "main")
      throw new Error("Production samples must be released from main.");
    const ref = env.SUPABASE_PROJECT_REF ?? "";
    if (
      !/^[a-z0-9]{20}$/.test(ref) ||
      target.origin !== `https://${ref}.supabase.co` ||
      target.pathname !== "/" ||
      target.search ||
      target.hash ||
      target.username ||
      target.password
    )
      throw new Error("SUPABASE_URL and SUPABASE_PROJECT_REF must match.");
  } else if (!["localhost", "127.0.0.1"].includes(target.hostname)) {
    throw new Error("db:seed only targets local Supabase.");
  }
  return { url, secret };
}
