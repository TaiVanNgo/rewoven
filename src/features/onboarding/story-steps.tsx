import {
  ArrowRightIcon,
  BookOpenIcon,
  FileTextIcon,
  MessageSquareIcon,
  PaperclipIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const projects = [
  [
    "Office Purchasing Pilot",
    "Manager approval tied to the request’s revision.",
  ],
  [
    "Expense Reimbursement Portal",
    "Lessons from duplicate submissions after a lost response.",
  ],
  [
    "Supplier Onboarding Workspace",
    "Document review is different from permission to spend.",
  ],
  ["Invoice Matching Pilot", "A failed matching pilot needed manual fallback."],
  ["Branch Inventory Request Portal", "Checking branch access on the server."],
  [
    "Audit Export Dashboard",
    "Recording who changed what, and defining export boundaries.",
  ],
  [
    "Staff Leave Approval Tool",
    "Time-bounded delegation in a different business context.",
  ],
  [
    "Marketing Content Approval Tool",
    "Editorial review is only a partial match for purchasing.",
  ],
  [
    "Purchasing Expansion Proposal",
    "Finance routing was proposed, never implemented.",
  ],
] as const;

export const storySteps = [
  <div key="company" className="flex flex-col gap-6">
    <p>
      Imagine you’re part of <strong>Threadline Delivery</strong>, a software
      delivery company. A new client needs a purchasing tool. Your team has
      built related workflows before, but the useful decisions and hard-earned
      lessons live across old briefs, implementation notes, and delivery
      reviews.
    </p>
    <Card variant="soft">
      <CardHeader>
        <CardTitle>“Which parts have we already solved?”</CardTitle>
        <CardDescription>That’s where Rewoven starts.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p>
          Ask Wren about your past projects. She finds relevant evidence, helps
          compare it with the new request, and prepares a reuse plan you can
          review and change.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="secondary">Past experience</Badge>
          <ArrowRightIcon aria-hidden="true" className="size-4" />
          <Badge variant="secondary">Evidence you can check</Badge>
          <ArrowRightIcon aria-hidden="true" className="size-4" />
          <Badge variant="secondary">Your next plan</Badge>
        </div>
      </CardContent>
    </Card>
    <p className="text-sm text-muted-foreground">
      You decide what to reuse, what needs adapting, and what still needs a
      conversation with the client.
    </p>
  </div>,
  <div key="archive" className="flex flex-col gap-5">
    <p>
      Nine Threadline projects are already in <strong>Case library</strong>,
      with three source documents each. They serve different clients; together,
      they give the team useful experience to draw on.
    </p>
    <ul
      aria-label="Nine historical projects"
      className="grid gap-x-6 md:grid-cols-2"
    >
      {projects.map(([name, lesson]) => (
        <li
          key={name}
          className="flex flex-col gap-1 border-b border-border py-3"
        >
          <h2 className="font-heading text-sm font-bold">{name}</h2>
          <p className="text-sm text-muted-foreground">{lesson}</p>
        </li>
      ))}
    </ul>
    <Alert variant="caution" role="note">
      <BookOpenIcon aria-hidden="true" />
      <AlertTitle>Different outcomes matter</AlertTitle>
      <AlertDescription>
        The archive includes delivered work, a failed pilot, and an
        unimplemented proposal. A proposed requirement is not proof that
        something shipped. Shared samples are read-only; there’s nothing you
        need to seed or upload.
      </AlertDescription>
    </Alert>
  </div>,
  <div key="evidence" className="flex flex-col gap-6">
    <p>
      Start with a question in <strong>New chat</strong>. Wren searches the full
      Case library by default. Use <strong>Add cases</strong> only when you want
      to focus on particular projects.
    </p>
    <Card variant="soft">
      <CardHeader>
        <CardTitle>For example, ask about a difficult retry</CardTitle>
        <CardDescription>
          Illustrative conversation — your actual answer uses retrieved sources.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="flex items-start gap-3">
          <MessageSquareIcon
            aria-hidden="true"
            className="mt-1 size-5 shrink-0"
          />
          “What did we learn about duplicate submissions when a connection drops
          after Send?”
        </p>
        <blockquote className="border-l-2 border-knowledge-ink pl-4 text-sm">
          The Expense Reimbursement Portal records a lost response that led to
          duplicate submissions. Its implementation notes describe the tested
          fix.
          <span className="ml-2 font-semibold text-knowledge-ink">[1]</span>
        </blockquote>
        <p className="text-sm text-muted-foreground">
          In a real reply, choose a numbered citation to inspect the original
          PDF page or highlighted text. Check whether it supports the claim.
        </p>
      </CardContent>
    </Card>
    <p>
      Follow up with “Would that approach fit our new request?” or “Was the
      purchasing expansion actually implemented?” You can also open a project in
      Case library and choose <strong>Ask Wren about this case</strong>.
    </p>
  </div>,
  <div key="request" className="flex flex-col gap-6">
    <p>
      <strong>Northbank Services</strong> now asks Threadline for a purchasing
      pilot across three branches: manager review, finance review for larger
      purchases, safe retries, and a history of decisions. No single past
      project solves the whole request.
    </p>
    <Card variant="soft">
      <CardHeader>
        <CardTitle>Bring the new work into chat</CardTitle>
        <CardDescription>
          Use the client input files supplied with this demo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            <FileTextIcon aria-hidden="true" />
            client-brief.pdf
          </Badge>
          <Badge variant="outline">
            <FileTextIcon aria-hidden="true" />
            constraints.md
          </Badge>
        </div>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>
            Choose <strong>Upload files</strong> in chat and select both files.
          </li>
          <li>
            Ask which projects help, what changes, and what is still unknown.
          </li>
          <li>
            Choose <strong>Send</strong>. Wren reads the files and compares them
            with historical evidence.
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          You can also type your own requirements, or combine text and files.
          Supported files are PDF, TXT, and Markdown.
        </p>
      </CardContent>
    </Card>
    <Alert role="note">
      <PaperclipIcon aria-hidden="true" />
      <AlertTitle>New request or past project?</AlertTitle>
      <AlertDescription>
        Client input files belong in chat. To add a historical project, use Case
        library’s create-case workflow. Chat attachments never automatically
        become historical cases. The nine demo cases are already available.
      </AlertDescription>
    </Alert>
  </div>,
  <div key="plan" className="flex flex-col gap-5">
    <p>
      After discussing the request, choose <strong>Draft reuse plan</strong> in
      your saved chat. Review Wren’s understanding before generating a draft.
    </p>
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Reuse plan workflow">
      {[
        [
          "Review, then generate",
          "Check the request, constraints, and open questions before generating a cited plan.",
        ],
        [
          "Edit, then Save",
          "Make the plan yours. Choose Save to keep edits in Saved plans for this session.",
        ],
        [
          "Export Markdown",
          "Download a copy to keep after your demo session ends.",
        ],
      ].map(([title, description], index) => (
        <li key={title} className="rounded-card bg-muted p-4">
          <p className="mb-2 text-sm text-knowledge-ink">{index + 1}</p>
          <h2 className="mb-2 font-heading text-sm font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </li>
      ))}
    </ol>
    <p className="text-sm text-muted-foreground">
      Keep historical facts, suggested adaptations, and unanswered questions
      separate. A plausible plan still needs your review.
    </p>
    <Alert role="note">
      <AlertTitle>Your demo session</AlertTitle>
      <AlertDescription>
        No sign-in is needed. Your cases, submitted chats, and saved plans stay
        accessible in this browser’s demo session for 24 hours. Separate
        browsers or devices have separate sessions, even on the same Wi-Fi; tabs
        in one browser profile share a session. Unsubmitted chat drafts reset on
        reload. Export a plan to keep your copy. Expiry ends access; it does not
        automatically delete stored files.
      </AlertDescription>
    </Alert>
  </div>,
];
