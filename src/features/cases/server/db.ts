import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./http";

export function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (
    !url ||
    !key ||
    url.includes("your-project") ||
    key.includes("replace-with") ||
    key.includes("your-server")
  ) {
    throw new ApiError(
      503,
      "Case storage is not configured. Follow the database setup in README, then restart the app.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function checkDatabase(error: { message: string } | null) {
  if (error) {
    if (
      /^Sources changed while Wren was answering\.|^This case was permanently deleted\./.test(
        error.message,
      )
    )
      throw new ApiError(409, error.message);
    console.error("Case database operation failed:", error.message);
    throw new ApiError(
      503,
      "Case storage is unavailable. Check Supabase is running and apply the local migrations, then try again.",
    );
  }
}
