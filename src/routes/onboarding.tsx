import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { fileToWebpDataUrl } from "~/lib/avatar";
import { branchValues, batchValues, collegeValues, divValues } from "~/lib/profile";
import { submitOnboarding, uploadAvatarAction } from "~/server/auth/actions";

export default function Onboarding() {
  const navigate = useNavigate();
  const [college, setCollege] = createSignal("");
  const [branch, setBranch] = createSignal("");
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
    } catch {
      setMessage("Could not read that image.");
    }
  };

  const uploadAvatar = async () => {
    const dataUrl = avatar();
    if (!dataUrl || uploading()) return;
    setUploading(true);
    setMessage("");
    try {
      await uploadAvatarAction(dataUrl);
      setMessage("Profile picture updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
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
        batch: (batch() || undefined) as "27" | "28" | "29" | "30" | "<=26" | undefined,
        div: (div() || undefined) as "none" | "a" | "b" | "c" | undefined,
        instagramHandle: instagram() || undefined,
        whatsappNumber: whatsapp() || undefined,
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
        <section class="space-y-1">
          <h1 class="text-3xl font-bold tracking-tight">Almost there</h1>
          <p class="text-muted">Tell us a little about yourself.</p>
        </section>

        <Show when={message()}>
          <p class="rounded border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">{message()}</p>
        </Show>

        <form onSubmit={onSubmit} class="card space-y-4">
          <fieldset class="space-y-2 border-0 p-0">
            <legend class="font-semibold">Avatar (optional)</legend>
            <div class="flex items-center gap-3">
              <Show when={avatar()}>
                <img
                  src={avatar()!}
                  alt="preview"
                  class="h-16 w-16 rounded-full border border-line"
                />
              </Show>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onAvatarChange(e.currentTarget.files?.[0])}
                class="text-sm text-muted"
              />
              <Show when={avatar()}>
                <button
                  type="button"
                  onClick={uploadAvatar}
                  disabled={uploading()}
                  class="btn-ghost text-sm"
                >
                  {uploading() ? "Uploading…" : "Upload"}
                </button>
              </Show>
            </div>
          </fieldset>

          <div>
            <label for="college" class="text-sm font-medium">
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
              <p class="mt-1 text-sm text-danger">{fieldError("college")}</p>
            </Show>
          </div>

          <Show when={college() === "mec"}>
            <div>
              <label for="branch" class="text-sm font-medium">
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
                <p class="mt-1 text-sm text-danger">{fieldError("branch")}</p>
              </Show>
            </div>

            <div>
              <label for="batch" class="text-sm font-medium">
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
                <p class="mt-1 text-sm text-danger">{fieldError("batch")}</p>
              </Show>
            </div>
          </Show>

          <div>
            <label for="div" class="text-sm font-medium">
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
            <label for="instagram" class="text-sm font-medium">
              Instagram handle <span class="text-muted">(optional, for winner tags)</span>
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
              <p class="mt-1 text-sm text-danger">{fieldError("instagramHandle")}</p>
            </Show>
          </div>

          <div>
            <label for="whatsapp" class="text-sm font-medium">
              WhatsApp number <span class="text-muted">(optional)</span>
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
              <p class="mt-1 text-sm text-danger">{fieldError("whatsappNumber")}</p>
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
