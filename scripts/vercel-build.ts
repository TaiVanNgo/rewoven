import { spawnSync } from "node:child_process";

const SUPABASE_CLI = "supabase@2.120.0";
type RunCommand = (command: string, args: string[]) => void;

const execute: RunCommand = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed; the deployment must not be published.`);
};

export function runVercelBuild({
  env = process.env,
  run = execute,
  log = console.info,
}: {
  env?: Record<string, string | undefined>;
  run?: RunCommand;
  log?: (message: string) => void;
} = {}) {
  const onVercel = env.VERCEL === "1";
  if (
    onVercel &&
    !["production", "preview", "development"].includes(env.VERCEL_ENV ?? "")
  )
    throw new Error(
      "Expose Vercel system environment variables before building.",
    );

  const production = onVercel && env.VERCEL_ENV === "production";
  const projectRef = env.SUPABASE_PROJECT_REF ?? "";
  if (production) {
    for (const name of [
      "SUPABASE_PROJECT_REF",
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
      "SUPABASE_URL",
    ]) {
      if (!env[name]?.trim())
        throw new Error(
          `Configure ${name} in Vercel's Production environment.`,
        );
    }
    if (env.VERCEL_GIT_COMMIT_REF && env.VERCEL_GIT_COMMIT_REF !== "main")
      throw new Error("Production migrations must be released from main.");

    if (!/^[a-z0-9]{20}$/.test(projectRef))
      throw new Error(
        "SUPABASE_PROJECT_REF must be the hosted project reference.",
      );
    let target: URL;
    try {
      target = new URL(env.SUPABASE_URL ?? "");
    } catch {
      throw new Error(
        "SUPABASE_URL must identify the hosted production project.",
      );
    }
    if (
      target.origin !== `https://${projectRef}.supabase.co` ||
      target.pathname !== "/" ||
      target.search ||
      target.hash ||
      target.username ||
      target.password
    )
      throw new Error("SUPABASE_URL and SUPABASE_PROJECT_REF must match.");
  }

  // A compilation failure should leave the production schema untouched.
  run("bun", ["run", "build"]);
  if (!production) {
    log("[vercel-build] Hosted migrations skipped outside Vercel Production.");
    return;
  }

  log(
    "[vercel-build] Applying production migrations and storage configuration.",
  );
  run("npx", ["--yes", SUPABASE_CLI, "link", "--project-ref", projectRef]);
  run("npx", ["--yes", SUPABASE_CLI, "db", "push", "--linked", "--yes"]);
  run("npx", ["--yes", SUPABASE_CLI, "seed", "buckets", "--linked", "--yes"]);
  log(
    "[vercel-build] Production database and storage are ready for deployment.",
  );
}

if (import.meta.main) {
  try {
    runVercelBuild();
  } catch (error) {
    console.error(
      "[vercel-build]",
      error instanceof Error ? error.message : "Build failed.",
    );
    process.exitCode = 1;
  }
}
