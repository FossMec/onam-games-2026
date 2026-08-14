import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { Camera } from "lucide-solid";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { fileToWebpDataUrl } from "~/lib/avatar";
import { branchValues, batchValues, collegeValues, divValues } from "~/lib/profile";
import { submitOnboarding, uploadAvatarAction } from "~/server/auth/actions";

export default function Onboarding() {
  const navigate = useNavigate();
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
        setMessage("Profile picture updated!");
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
        college: college() as "mec" | "other",
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
        navigate("/", { replace: true });
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
      <Title>Complete your profile — FOSS Onam Games</Title>

      <div class="w-full max-w-lg space-y-6">
        <section class="space-y-2">
          <div class="flex items-center gap-3">
            <SpriteIcon name="tux-king" size={44} animate="float" interactive />
            <h1 class="rule">Almost there</h1>
          </div>
          <p class="font-semibold">
            Tell us who you are so the leaderboard knows who to embarrass.
          </p>
          <p class="comment">two required fields. the rest is so we can tag you when you win.</p>
        </section>

        <Show when={message()}>
          <div class="card pop-teal">
            <p class="font-extrabold">{message()}</p>
          </div>
        </Show>

        <form onSubmit={onSubmit} class="card space-y-4">
          <fieldset class="space-y-3 border-0 p-0">
            <legend class="font-extrabold">
              Avatar <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
            </legend>
            <div class="flex items-center gap-5">
              {/* Clickable avatar circle */}
              <label
                for="avatar-input"
                class="relative shrink-0 cursor-pointer group"
                title={uploading() ? "Uploading…" : "Click to change photo"}
              >
                <div
                  class="w-20 h-20 rounded-full overflow-hidden grid place-items-center transition-all group-hover:opacity-80"
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
                        <Camera size={22} />
                        <span class="text-[9px] font-extrabold uppercase tracking-wide">Photo</span>
                      </div>
                    }
                  >
                    <img src={avatar()!} alt="Avatar preview" class="w-full h-full object-cover" />
                  </Show>
                </div>
                {/* Edit overlay on hover */}
                <div
                  class="absolute inset-0 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.35)" }}
                >
                  <Camera size={18} color="white" />
                </div>
                {/* Uploading spinner ring */}
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
                <p class="font-extrabold text-sm">Profile photo</p>
                <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {uploading() ? "Uploading…" : "Click the circle to pick an image"}
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

          <div>
            <label for="college" class="font-extrabold">
              College *
            </label>
            <select
              id="college"
              value={college()}
              onChange={(e) => setCollege(e.currentTarget.value)}
              class="input"
            >
              <option value="" disabled>
                Select college
              </option>
              <For each={collegeValues}>
                {(value) => <option value={value}>{value.toUpperCase()}</option>}
              </For>
            </select>
            <Show when={fieldError("college")}>
              <p class="mt-1 font-extrabold" style={{ color: "var(--pop-red)" }}>
                {fieldError("college")}
              </p>
            </Show>
          </div>

          <Show when={college() === "other"}>
            <div>
              <label for="collegeOther" class="font-extrabold">
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
              <p class="comment">This shows next to your name on the leaderboard.</p>
              <Show when={fieldError("collegeOther")}>
                <p class="mt-1 font-extrabold" style={{ color: "var(--pop-red)" }}>
                  {fieldError("collegeOther")}
                </p>
              </Show>
            </div>
          </Show>

          <Show when={college() === "mec"}>
            <div>
              <label for="branch" class="font-extrabold">
                Branch *
              </label>
              <select
                id="branch"
                value={branch()}
                onChange={(e) => setBranch(e.currentTarget.value)}
                class="input"
              >
                <option value="" disabled>
                  Select branch
                </option>
                <For each={branchValues}>
                  {(value) => <option value={value}>{value.toUpperCase()}</option>}
                </For>
              </select>
              <Show when={fieldError("branch")}>
                <p class="mt-1 font-extrabold" style={{ color: "var(--pop-red)" }}>
                  {fieldError("branch")}
                </p>
              </Show>
            </div>

            <Show when={branch() === "other"}>
              <div>
                <label for="branchOther" class="font-extrabold">
                  Which branch? *
                </label>
                <input
                  id="branchOther"
                  value={branchOther()}
                  onInput={(e) => setBranchOther(e.currentTarget.value)}
                  placeholder="e.g. Architecture"
                  maxLength={60}
                  class="input"
                />
                <Show when={fieldError("branchOther")}>
                  <p class="mt-1 font-extrabold" style={{ color: "var(--pop-red)" }}>
                    {fieldError("branchOther")}
                  </p>
                </Show>
              </div>
            </Show>

            <div>
              <label for="batch" class="font-extrabold">
                Batch *
              </label>
              <select
                id="batch"
                value={batch()}
                onChange={(e) => setBatch(e.currentTarget.value)}
                class="input"
              >
                <option value="" disabled>
                  Select batch
                </option>
                <For each={batchValues}>{(value) => <option value={value}>{value}</option>}</For>
              </select>
              <Show when={fieldError("batch")}>
                <p class="mt-1 font-extrabold" style={{ color: "var(--pop-red)" }}>
                  {fieldError("batch")}
                </p>
              </Show>
            </div>
          </Show>

          <div>
            <label for="div" class="font-extrabold">
              Division
            </label>
            <select
              id="div"
              value={div()}
              onChange={(e) => setDiv(e.currentTarget.value)}
              class="input"
            >
              <For each={divValues}>
                {(value) => <option value={value}>{value.toUpperCase()}</option>}
              </For>
            </select>
          </div>

          <div>
            <label for="instagram" class="font-extrabold">
              Instagram handle{" "}
              <span style={{ color: "var(--ink-soft)" }}>(optional, for winner tags)</span>
            </label>
            <input
              id="instagram"
              type="text"
              value={instagram()}
              onChange={(e) => setInstagram(e.currentTarget.value)}
              placeholder="@username"
              class="input"
            />
            <Show when={fieldError("instagramHandle")}>
              <p class="mt-1 font-extrabold" style={{ color: "var(--pop-red)" }}>
                {fieldError("instagramHandle")}
              </p>
            </Show>
          </div>

          <div>
            <label for="whatsapp" class="font-extrabold">
              WhatsApp number <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
            </label>
            <input
              id="whatsapp"
              type="tel"
              value={whatsapp()}
              onChange={(e) => setWhatsapp(e.currentTarget.value)}
              placeholder="+91 98765 43210"
              class="input"
            />
            <Show when={fieldError("whatsappNumber")}>
              <p class="mt-1 font-extrabold" style={{ color: "var(--pop-red)" }}>
                {fieldError("whatsappNumber")}
              </p>
            </Show>
          </div>

          <button type="submit" disabled={submitting()} class="btn-brand w-full">
            {submitting() ? "Saving…" : "Save & continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
