import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";
import { shell } from "~/lib/queries";

const OnboardingView = clientOnly(() =>
  import("~/components/onboarding/OnboardingView").then((m) => ({
    default: m.OnboardingView,
  })),
);

export default function Onboarding() {
  const shellData = createAsync(() => shell());
  const me = () => shellData()?.me ?? undefined;

  return (
    <>
      <Title>
        {me()?.onboardingCompleted ? "Edit Profile" : "Complete your profile"} - Onam Games
      </Title>
      <OnboardingView fallback={<LoadingScreen message="Loading profile…" />} />
    </>
  );
}
