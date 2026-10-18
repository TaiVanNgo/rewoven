import "server-only";
import { checkDatabase, database } from "./db";
import { ApiError, validId } from "./http";

type CleanupJob = {
  case_id: string;
  session_id: string;
  storage_paths: string[];
  final_sweep_at: string;
};
type RemoveFiles = (paths: string[]) => Promise<void>;
const removeFiles: RemoveFiles = async (paths) => {
  const result = await database().storage.from("case-sources").remove(paths);
  if (result.error)
    throw new Error("Original-file cleanup needs another attempt.");
};

// Both the browser endpoint and maintenance command use this bounded, retryable
// sweep. No model calls, and no dependency on the deleted case/session remaining.
export async function cleanupDeletedCases(
  sessionId: string | null,
  remove: RemoveFiles = removeFiles,
  caseId?: string,
) {
  const db = database();
  let query = db
    .from("case_deletions")
    .select("case_id,session_id,storage_paths,final_sweep_at")
    .eq("cleanup_complete", false)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(20);
  if (sessionId) query = query.eq("session_id", sessionId);
  if (caseId) query = query.eq("case_id", caseId);
  const result = await query;
  checkDatabase(result.error);
  let failed = 0;
  for (const job of (result.data ?? []) as CleanupJob[]) {
    try {
      await remove(job.storage_paths);
    } catch {
      failed++;
      checkDatabase(
        (
          await db
            .from("case_deletions")
            .update({
              last_error: "Original-file cleanup needs another attempt.",
              next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
            })
            .eq("case_id", job.case_id)
            .eq("cleanup_complete", false)
        ).error,
      );
      continue;
    }
    const final = Date.parse(job.final_sweep_at) <= Date.now();
    checkDatabase(
      (
        await db
          .from("case_deletions")
          .update({
            last_error: null,
            cleanup_complete: final,
            ...(final ? { storage_paths: [] } : {}),
            next_attempt_at: final
              ? new Date().toISOString()
              : job.final_sweep_at,
          })
          .eq("case_id", job.case_id)
          .eq("cleanup_complete", false)
      ).error,
    );
  }
  return { attempted: result.data?.length ?? 0, failed };
}

export async function deleteCase(
  caseId: string,
  sessionId: string,
  remove?: RemoveFiles,
) {
  const id = validId(caseId);
  const db = database();
  const result = await db.rpc("delete_owned_case", {
    p_case: id,
    p_session: sessionId,
  });
  checkDatabase(result.error);
  if (result.data === "expired")
    throw new ApiError(
      401,
      "Your demo session has expired. Reload the library.",
    );
  if (result.data === "readonly")
    throw new ApiError(403, "Fictional samples are read-only.");
  if (result.data !== "deleted")
    throw new ApiError(404, "Case not found in this demo session.");
  // The deletion is committed. Cleanup failure must never imply that the case
  // still exists; the durable receipt is retried by the library or command.
  try {
    await cleanupDeletedCases(sessionId, remove, id);
  } catch {
    return { deleted: true as const, cleanupPending: true };
  }
  const receipt = await db
    .from("case_deletions")
    .select("cleanup_complete")
    .eq("case_id", id)
    .eq("session_id", sessionId)
    .maybeSingle();
  return {
    deleted: true as const,
    cleanupPending: receipt.error !== null || !receipt.data?.cleanup_complete,
  };
}
