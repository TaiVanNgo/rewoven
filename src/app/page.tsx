import { MotionDemo } from "@/components/motion-demo";
import { createPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = createPageMetadata({ path: "/" });

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-xl space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {site.name}
        </h1>
        <p className="text-lg leading-relaxed text-foreground/70">
          Start with your idea. Replace this page with the first feature of your
          project.
        </p>
        <MotionDemo />
      </div>
    </main>
  );
}
