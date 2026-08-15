import { Title } from "@solidjs/meta";
import { createAsync, useNavigate } from "@solidjs/router";
import { Camera, CheckCircle2, User } from "lucide-solid";
import { For, Show, createEffect, createSignal } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { fileToWebpDataUrl } from "~/lib/avatar";
import {
  batchLabel,
  batchValues,
  branchLabel,
  branchValues,
  collegeOptionLabel,
  collegeValues,
  divValues,
} from "~/lib/profile";
import { getMe, submitOnboarding, uploadAvatarAction } from "~/server/auth/actions";

export default function Onboarding() {
  const navigate = useNavigate();
  const me = createAsync(() => getMe());

  const [college, setCollege] = createSignal("");
  const [collegeOther, setCollegeOther] = createSignal("");
  const [branch, setBranch] = createSignal("");
  const [branchOther, setBranchOther] = createSignal("");
  const [batch, setBatch] = createSignal("");
  const [div, setDiv] = createSignal("none");
  const [instagram, setInstagram] = createSignal("");
  const [whatsapp, setWhatsapp] = createSignal("");
  const [avatar, setAvatar] = createSignal<string | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [errors, setErrors] = createSignal<Record<string, string[]> | null>(null);
  const [message, setMessage] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);

  // Pre-fill profile fields whenever current user data is loaded
  createEffect(() => {
    const user = me();
    if (user && !loaded()) {
      if (user.college) {
        setCollege(user.college);
      } else if (user.email?.endsWith("@mec.ac.in")) {
        setCollege("mec");
      }
      if (user.collegeOther) setCollegeOther(user.collegeOther);
      if (user.branch) setBranch(user.branch);
      if (user.branchOther) setBranchOther(user.branchOther);
      if (user.batch) setBatch(user.batch);
      if (user.div) setDiv(user.div);
      if (user.instagramHandle) setInstagram(user.instagramHandle);
      if (user.whatsappNumber) setWhatsapp(user.whatsappNumber);
      if (user.avatarUrl) setAvatar(user.avatarUrl);
      setLoaded(true);
    }
  });

  const onAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToWebpDataUrl(file);
      setAvatar(dataUrl);
      // auto-upload immediately
      setUploading(true);
      setMessage("");
      try {
        await uploadAvatarAction(dataUrl);
        setMessage("Profile photo updated successfully!");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    } catch {
      setMessage("Could not read that image.");
    }
  };

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (submitting()) return;
    setSubmitting(true);
    setErrors(null);
    setMessage("");
    try {
      const result = await submitOnboarding({
        college: (college() || undefined) as "mec" | "other",
        branch: (branch() || undefined) as
          | "cs"
          | "cu"
          | "ee"
          | "eb"
          | "ec"
          | "ev"
          | "me"
          | "other"
          | undefined,
        collegeOther: collegeOther().trim() || undefined,
        branchOther: branchOther().trim() || undefined,
        batch: (batch() || undefined) as "27" | "28" | "29" | "30" | "<=26" | undefined,
        div: (div() || undefined) as "none" | "a" | "b" | "c" | undefined,
        instagramHandle: instagram().trim().replace(/^@+/, "") || undefined,
        whatsappNumber: whatsapp().replace(/[\s\-()]/g, "") || undefined,
      });
      if (result.ok) {
        if (me()?.onboardingCompleted) {
          setMessage("Profile updated successfully!");
          setTimeout(() => navigate("/", { replace: true }), 600);
        } else {
          navigate("/", { replace: true });
        }
      } else {
        setErrors(result.errors ?? null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (field: string) => errors()?.[field]?.[0];

  return (
    <main class="container flex justify-center py-8">
      <Title>
        {me()?.onboardingCompleted ? "Edit Profile" : "Complete your profile"} — FOSS Onam Games
      </Title>

      <div class="w-full max-w-lg space-y-6">
        <section class="space-y-2">
          <div class="flex items-center gap-3">
            <SpriteIcon name="tux-king" size={44} animate="float" interactive />
            <h1 class="rule">{me()?.onboardingCompleted ? "Edit Profile" : "Almost there"}</h1>
          </div>
          <p class="font-semibold">
            {me()?.onboardingCompleted
              ? "Update your college, batch, branch, or contact info."
              : "Tell us who you are so the leaderboard knows who to embarrass."}
          </p>
          <p class="comment">
            {me()?.onboardingCompleted
              ? "Changes reflect immediately across leaderboards and games."
              : "two required fields. the rest is so we can tag you when you win."}
          </p>
        </section>

        <Show when={message()}>
          <div class="card pop-teal flex items-center gap-2 p-3">
            <CheckCircle2 size={18} strokeWidth={2.5} />
            <p class="font-extrabold text-xs sm:text-sm m-0">{message()}</p>
          </div>
        </Show>

        <form onSubmit={onSubmit} class="card space-y-4">
          {/* Avatar upload */}
          <fieldset class="space-y-3 border-0 p-0">
            <legend class="font-extrabold text-sm">
              Avatar <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
            </legend>
            <div class="flex items-center gap-5">
              <label
                for="avatar-input"
                class="relative shrink-0 cursor-pointer group select-none"
                title={uploading() ? "Uploading…" : "Click to change photo"}
              >
                <div
                  class="w-20 h-20 rounded-full overflow-hidden grid place-items-center transition-all group-hover:opacity-85"
                  style={{
                    border: "var(--ink-w-bold) solid var(--ink)",
                    background: "var(--pop-yellow)",
                  }}
                >
                  <Show
                    when={avatar()}
                    fallback={
                      <div
                        class="flex flex-col items-center gap-1"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        <User size={26} />
                        <span class="text-[9px] font-extrabold uppercase tracking-wide">Photo</span>
                      </div>
                    }
                  >
                    <img src={avatar()!} alt="Avatar preview" class="w-full h-full object-cover" />
                  </Show>
                </div>
                <div
                  class="absolute inset-0 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.35)" }}
                >
                  <Camera size={18} color="white" />
                </div>
                <Show when={uploading()}>
                  <div
                    class="absolute inset-0 rounded-full"
                    style={{
                      border: "3px solid transparent",
                      "border-top-color": "var(--pop-teal)",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                </Show>
              </label>

              <div class="space-y-1 min-w-0">
                <p class="font-extrabold text-sm">{me()?.name || "Player"}</p>
                <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {uploading() ? "Uploading…" : "Click the circle to pick a profile photo"}
                </p>
                <Show when={avatar() && !uploading()}>
                  <p class="text-xs font-extrabold" style={{ color: "var(--pop-teal-deep)" }}>
                    ✓ Photo saved
                  </p>
                </Show>
              </div>
            </div>

            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              class="sr-only"
              onChange={(e) => onAvatarChange(e.currentTarget.files?.[0])}
            />
          </fieldset>

          {/* College Selection */}
          <div>
            <label for="college" class="font-extrabold text-sm block mb-1">
              College *
            </label>
            <select
              id="college"
              value={college()}
              onChange={(e) => setCollege(e.currentTarget.value)}
              class="input font-bold"
            >
              <option value="" disabled>
                Select your college
              </option>
              <For each={collegeValues}>
                {(value) => <option value={value}>{collegeOptionLabel(value)}</option>}
              </For>
            </select>
            <Show when={fieldError("college")}>
              <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                {fieldError("college")}
              </p>
            </Show>
          </div>

          {/* If Other College Selected */}
          <Show when={college() === "other"}>
            <div>
              <label for="collegeOther" class="font-extrabold text-sm block mb-1">
                Where are you from? *
              </label>
              <input
                id="collegeOther"
                value={collegeOther()}
                onInput={(e) => setCollegeOther(e.currentTarget.value)}
                placeholder="College, school, or 'Working professional'"
                maxLength={80}
                class="input"
              />
              <p class="comment mt-1">This shows next to your name on the leaderboard.</p>
              <Show when={fieldError("collegeOther")}>
                <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                  {fieldError("collegeOther")}
                </p>
              </Show>
            </div>
          </Show>

          {/* Branch Selection (Required for MEC, Optional for Other) */}
          <Show when={college() !== ""}>
            <div>
              <label for="branch" class="font-extrabold text-sm block mb-1">
                Branch {college() === "mec" ? "*" : "(optional)"}
              </label>
              <select
                id="branch"
                value={branch()}
                onChange={(e) => setBranch(e.currentTarget.value)}
                class="input font-bold"
              >
                <option value="">
                  {college() === "mec" ? "Select branch" : "Select branch (optional)"}
                </option>
                <For each={branchValues}>
                  {(value) => <option value={value}>{branchLabel(value)}</option>}
                </For>
              </select>
              <Show when={fieldError("branch")}>
                <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                  {fieldError("branch")}
                </p>
              </Show>
            </div>

            {/* Custom Branch text if 'other' branch is picked */}
            <Show when={branch() === "other"}>
              <div>
                <label for="branchOther" class="font-extrabold text-sm block mb-1">
                  Which branch? *
                </label>
                <input
                  id="branchOther"
                  value={branchOther()}
                  onInput={(e) => setBranchOther(e.currentTarget.value)}
                  placeholder="e.g. Architecture, Biotechnology, MCA"
                  maxLength={60}
                  class="input"
                />
                <Show when={fieldError("branchOther")}>
                  <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                    {fieldError("branchOther")}
                  </p>
                </Show>
              </div>
            </Show>

            {/* Batch / Graduation Year (Required for MEC, Optional for Other) */}
            <div>
              <label for="batch" class="font-extrabold text-sm block mb-1">
                Batch / Graduation Year {college() === "mec" ? "*" : "(optional)"}
              </label>
              <select
                id="batch"
                value={batch()}
                onChange={(e) => setBatch(e.currentTarget.value)}
                class="input font-bold"
              >
                <option value="">
                  {college() === "mec" ? "Select batch" : "Select batch / year (optional)"}
                </option>
                <For each={batchValues}>
                  {(value) => <option value={value}>{batchLabel(value)}</option>}
                </For>
              </select>
              <Show when={fieldError("batch")}>
                <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                  {fieldError("batch")}
                </p>
              </Show>
            </div>

            {/* Division (Shown for MEC or if filled) */}
            <Show when={college() === "mec" || div() !== "none"}>
              <div>
                <label for="div" class="font-extrabold text-sm block mb-1">
                  Division
                </label>
                <select
                  id="div"
                  value={div()}
                  onChange={(e) => setDiv(e.currentTarget.value)}
                  class="input font-bold"
                >
                  <For each={divValues}>
                    {(value) => (
                      <option value={value}>
                        {value === "none"
                          ? "None / Not Applicable"
                          : `Division ${value.toUpperCase()}`}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </Show>
          </Show>

          {/* Socials */}
          <div>
            <label for="instagram" class="font-extrabold text-sm block mb-1">
              Instagram handle{" "}
              <span style={{ color: "var(--ink-soft)" }}>(optional, for winner tags)</span>
            </label>
            <input
              id="instagram"
              type="text"
              value={instagram()}
              onInput={(e) => setInstagram(e.currentTarget.value)}
              placeholder="@username"
              class="input"
            />
            <Show when={fieldError("instagramHandle")}>
              <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                {fieldError("instagramHandle")}
              </p>
            </Show>
          </div>

          <div>
            <label for="whatsapp" class="font-extrabold text-sm block mb-1">
              WhatsApp number <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
            </label>
            <input
              id="whatsapp"
              type="tel"
              value={whatsapp()}
              onInput={(e) => setWhatsapp(e.currentTarget.value)}
              placeholder="+91 98765 43210"
              class="input"
            />
            <Show when={fieldError("whatsappNumber")}>
              <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                {fieldError("whatsappNumber")}
              </p>
            </Show>
          </div>

          <button
            type="submit"
            disabled={submitting()}
            class="btn-brand w-full py-2.5 text-sm font-black cursor-pointer disabled:opacity-50"
          >
            {submitting()
              ? "Saving…"
              : me()?.onboardingCompleted
                ? "Save Profile Changes"
                : "Save & continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
