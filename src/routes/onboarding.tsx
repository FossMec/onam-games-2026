import { Title } from "@solidjs/meta";
import { createAsync, useNavigate } from "@solidjs/router";
import { clientOnly } from "@solidjs/start";
import { createEffect } from "solid-js";
import { LoadingScreen } from "~/components/LoadingScreen";
import { shell } from "~/lib/queries";

const OnboardingView = clientOnly(() =>
  import("~/components/onboarding/OnboardingView").then((m) => ({
    default: m.OnboardingView,
  })),
);

export default function Onboarding() {
  const navigate = useNavigate();
  const shellData = createAsync(() => shell());
  const me = () => shellData()?.me ?? undefined;

  /*
   * Open-to-all guests have no college, branch, batch or phone number to give -
   * they signed up with a name and that is the whole profile. Sending one here
   * (a bookmarked link, the back button) would show a form full of mandatory
   * fields that do not apply, so they are turned around at the door.
   */
  createEffect(() => {
    if (me()?.isGuest) navigate("/", { replace: true });
  });

  return (
    <>
      <Title>
        {me()?.onboardingCompleted ? "Edit Profile" : "Complete your profile"} - Onam Games
      </Title>
      <OnboardingView fallback={<LoadingScreen message="Loading profile…" />} />
    </>
  );
}
