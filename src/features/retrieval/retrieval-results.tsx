import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RetrievalResult } from "./types";
export function RetrievalResults({ result }: { result: RetrievalResult }) {
  return (
    <section aria-label="Relevant past cases" className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-bold">Relevant past cases</h2>
      <Badge variant="outline">
        {result.mode === "hybrid"
          ? "Semantic + keyword search"
          : "Keyword search only"}
      </Badge>
      {result.warnings.length > 0 && (
        <Alert variant="caution">
          <AlertTitle>Search coverage</AlertTitle>
          <AlertDescription>
            {result.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {!result.cases.length ? (
        <Alert>
          <AlertTitle>No relevant cases found</AlertTitle>
          <AlertDescription>
            Try describing a specific capability or approach. Check that your
            project documents have finished indexing.
          </AlertDescription>
        </Alert>
      ) : (
        result.cases.map((record) => (
          <Card variant="soft" key={record.id}>
            <CardHeader>
              <CardTitle>{record.title}</CardTitle>
              <CardDescription>
                {record.outcome
                  ? `Recorded outcome: ${record.outcome}`
                  : "Outcome not recorded. These passages do not establish project success."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {record.passages.map((p) => (
                <blockquote
                  key={p.chunk_id}
                  className="border-l-2 border-primary pl-4"
                >
                  <p className="text-sm wrap-anywhere whitespace-pre-wrap">
                    {p.text}
                  </p>
                  <Link
                    className="mt-2 inline-block text-sm underline underline-offset-4"
                    href={`/case-library?case=${record.id}&source=${p.source_id}&page=${p.page_number ?? 1}&start=${p.char_start}&end=${p.char_end}`}
                  >
                    {p.source_title} · v{p.version}
                    {p.page_number ? ` · Page ${p.page_number}` : ""} · View
                    passage
                  </Link>
                </blockquote>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </section>
  );
}
