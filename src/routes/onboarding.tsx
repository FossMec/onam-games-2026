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
    <main>
      <Title>Complete your profile — FOSS Onam Games</Title>
      <h1>Almost there</h1>
      <p>Tell us a little about yourself.</p>

      <Show when={message()}>
        <p>{message()}</p>
      </Show>

      <form onSubmit={onSubmit}>
        <fieldset>
          <legend>Avatar (optional)</legend>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onAvatarChange(e.currentTarget.files?.[0])}
          />
          <Show when={avatar()}>
            <img src={avatar()!} alt="preview" width="96" height="96" />
            <button type="button" onClick={uploadAvatar} disabled={uploading()}>
              {uploading() ? "Uploading…" : "Upload avatar"}
            </button>
          </Show>
        </fieldset>

        <label>
          College
          <select value={college()} onChange={(e) => setCollege(e.currentTarget.value)}>
            <option value="" disabled>
              Select college
            </option>
            <For each={collegeValues}>
              {(value) => <option value={value}>{value.toUpperCase()}</option>}
            </For>
          </select>
        </label>
        <Show when={fieldError("college")}>
          <p role="alert">{fieldError("college")}</p>
        </Show>

        <Show when={college() === "mec"}>
          <label>
            Branch
            <select value={branch()} onChange={(e) => setBranch(e.currentTarget.value)}>
              <option value="" disabled>
                Select branch
              </option>
              <For each={branchValues}>
                {(value) => <option value={value}>{value.toUpperCase()}</option>}
              </For>
            </select>
          </label>
          <Show when={fieldError("branch")}>
            <p role="alert">{fieldError("branch")}</p>
          </Show>

          <label>
            Batch
            <select value={batch()} onChange={(e) => setBatch(e.currentTarget.value)}>
              <option value="" disabled>
                Select batch
              </option>
              <For each={batchValues}>{(value) => <option value={value}>{value}</option>}</For>
            </select>
          </label>
          <Show when={fieldError("batch")}>
            <p role="alert">{fieldError("batch")}</p>
          </Show>
        </Show>

        <label>
          Division
          <select value={div()} onChange={(e) => setDiv(e.currentTarget.value)}>
            <For each={divValues}>
              {(value) => <option value={value}>{value.toUpperCase()}</option>}
            </For>
          </select>
        </label>

        <label>
          Instagram handle (optional, for winner tags)
          <input
            type="text"
            value={instagram()}
            onChange={(e) => setInstagram(e.currentTarget.value)}
            placeholder="@username"
          />
        </label>
        <Show when={fieldError("instagramHandle")}>
          <p role="alert">{fieldError("instagramHandle")}</p>
        </Show>

        <label>
          WhatsApp number (optional)
          <input
            type="tel"
            value={whatsapp()}
            onChange={(e) => setWhatsapp(e.currentTarget.value)}
            placeholder="+91 98765 43210"
          />
        </label>
        <Show when={fieldError("whatsappNumber")}>
          <p role="alert">{fieldError("whatsappNumber")}</p>
        </Show>

        <button type="submit" disabled={submitting()}>
          {submitting() ? "Saving…" : "Save & continue"}
        </button>
      </form>
    </main>
  );
}
