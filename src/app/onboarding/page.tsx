import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import { storySteps } from "@/features/onboarding/story-steps";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  path: "/onboarding",
  title: "How to use Rewoven",
  description:
    "Meet Threadline Delivery, explore nine fictional projects, and learn how to ask Wren, check sources, and draft a reuse plan.",
});

export default function OnboardingPage() {
  return <OnboardingFlow steps={storySteps} />;
}
