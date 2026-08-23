import { Title } from "@solidjs/meta";
import { createAsync, useNavigate } from "@solidjs/router";
import {
  BookOpen,
  Briefcase,
  Camera,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  MessageCircle,
  User,
} from "lucide-solid";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { fileToWebpDataUrl } from "~/lib/avatar";
import {
  activeBatchValues,
  batchLabel,
  branchLabel,
  branchValues,
  collegeOptionLabel,
  collegeValues,
  divValues,
  occupationLabel,
  occupationValues,
  type Batch,
  type Branch,
  type College,
  type Div,
  type Occupation,
} from "~/lib/profile";
import { submitOnboarding, uploadAvatarAction } from "~/server/auth/actions";
import { shell } from "~/lib/queries";

export function OnboardingView() {
  const navigate = useNavigate();
  const shellData = createAsync(() => shell());
  const me = () => shellData()?.me ?? undefined;

  const [occupation, setOccupation] = createSignal<Occupation>("student");
  const [college, setCollege] = createSignal<string>("mec");
  const [collegeOther, setCollegeOther] = createSignal("");
  const [branch, setBranch] = createSignal<string>("");
  const [branchOther, setBranchOther] = createSignal("");
  const [batch, setBatch] = createSignal<string>("");
  const [div, setDiv] = createSignal("none");
  const [instagram, setInstagram] = createSignal("");
  const [whatsapp, setWhatsapp] = createSignal("");
  const [avatar, setAvatar] = createSignal<string | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [errors, setErrors] = createSignal<Record<string, string[]> | null>(null);
  const [message, setMessage] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [justCompleted, setJustCompleted] = createSignal(false);

  const whatsappUrl = createMemo(() => {
    const links = shellData()?.communityLinks;
    if (!links) return "";
    const user = me();
    // After onboarding is persisted, use stored college/batch. Before persistence
    // (just after submit) fall back to the form values so the link appears
    // without waiting for a revalidation round-trip.
    const isMec = user?.onboardingCompleted
      ? user.college === "mec"
      : occupation() === "student" && college() === "mec";
    const b = user?.onboardingCompleted ? user.batch : batch();
    if (!isMec || !b) return "";
    if (b === "27" && links.mec2027?.trim()) return links.mec2027.trim();
    if (b === "28" && links.mec2028?.trim()) return links.mec2028.trim();
    if (b === "29" && links.mec2029?.trim()) return links.mec2029.trim();
    if (b === "30" && links.mec2030?.trim()) return links.mec2030.trim();
    return "";
  });

  const batchTag = createMemo(() => {
    const b = me()?.onboardingCompleted ? me()?.batch : batch();
    if (b === "27") return "Batch '27";
    if (b === "28") return "Batch '28";
    if (b === "29") return "Batch '29";
    if (b === "30") return "Batch '30";
    return b ? `Batch '${b}` : "your batch";
  });

  const batchName = createMemo(() => {
    const b = me()?.onboardingCompleted ? me()?.batch : batch();
    if (b === "27") return "Batch '27 (4th Year)";
    if (b === "28") return "Batch '28 (3rd Year)";
    if (b === "29") return "Batch '29 (2nd Year)";
    if (b === "30") return "Batch '30 (1st Year)";
    return batchTag();
  });

  // Pre-fill profile fields whenever current user data is loaded
  createEffect(() => {
    const user = me();
    if (user && !loaded()) {
      if (user.occupation) setOccupation((user.occupation as Occupation) || "student");
      if (user.college) {
        setCollege(user.college);
      } else if (!user.college && (user.occupation === "student" || !user.occupation)) {
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

  const cleanInstagram = () =>
    instagram()
      .trim()
      .replace(/^@+/, "")
      .replace(/[^a-zA-Z0-9._]/g, "");

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (submitting()) return;
    setSubmitting(true);
    setErrors(null);
    setMessage("");
    try {
      const result = await submitOnboarding({
        occupation: occupation(),
        college: (college() || undefined) as College,
        branch: (branch() || undefined) as Branch | undefined,
        collegeOther: collegeOther().trim() || undefined,
        branchOther: branchOther().trim() || undefined,
        batch: (batch() || undefined) as Batch | undefined,
        div: (div() || undefined) as Div | undefined,
        instagramHandle: cleanInstagram() || undefined,
        whatsappNumber: whatsapp().replace(/[\s\-()]/g, ""),
      });
      if (result.ok) {
        if (me()?.onboardingCompleted) {
          setMessage("Profile updated successfully!");
          setTimeout(() => navigate("/", { replace: true }), 600);
        } else {
          setJustCompleted(true);
          setMessage("Profile completed! Welcome aboard 🎉");
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
        {me()?.onboardingCompleted ? "Edit Profile" : "Complete your profile"} - Onam Games
      </Title>

      <div class="w-full max-w-lg space-y-6">
        <section class="space-y-2">
          <div class="flex items-center gap-3">
            <SpriteIcon name="tux-king" size={44} animate="float" interactive />
            <h1 class="rule">{me()?.onboardingCompleted ? "Edit Profile" : "Almost there"}</h1>
          </div>
          <p class="font-semibold">
            {me()?.onboardingCompleted
              ? "Update your avatar, branch, batch, or social profiles."
              : "Tell us who you are so the leaderboard knows who to celebrate."}
          </p>
          <p class="comment">
            {me()?.onboardingCompleted
              ? "Changes reflect immediately across leaderboards, game cards, and sharing."
              : "Quick setup so we can tag you when you win."}
          </p>
        </section>

        <Show when={message()}>
          <div class="card pop-teal flex items-center gap-2 p-3">
            <CheckCircle2 size={18} strokeWidth={2.5} />
            <p class="font-extrabold text-xs sm:text-sm m-0">{message()}</p>
          </div>
        </Show>

        <Show
          when={!justCompleted()}
          fallback={
            <div class="space-y-4">
              <div class="card pop-yellow p-4 sm:p-5 space-y-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-lg bg-[var(--pop-teal)] border-2 border-[var(--ink)] grid place-items-center shrink-0">
                    <CheckCircle2 size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 class="m-0 text-base sm:text-lg font-black">You're all set! 🎉</h2>
                    <p class="m-0 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                      Profile saved for {batchName()}.
                    </p>
                  </div>
                </div>

                <Show
                  when={whatsappUrl()}
                  fallback={
                    <p class="text-xs font-semibold leading-relaxed">
                      Head to the games — your profile is ready and the leaderboard knows who to
                      cheer for.
                    </p>
                  }
                >
                  <div class="rounded-lg p-3 sm:p-4 bg-[var(--paper)] border-2 border-[var(--ink)] space-y-2.5">
                    <div class="flex items-start gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-[#25D366] border-2 border-[var(--ink)] grid place-items-center shrink-0">
                        <MessageCircle size={16} strokeWidth={2.5} color="white" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p
                          class="m-0 text-xs font-black uppercase tracking-wide"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          Exclusive for {batchName()}
                        </p>
                        <h3 class="m-0 text-sm sm:text-base font-black leading-tight">
                          Join the FOSS MEC {batchTag()} WhatsApp group
                        </h3>
                        <p
                          class="m-0 text-xs font-semibold leading-relaxed"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          Connect with your batchmates, get clues & launch updates.
                        </p>
                      </div>
                    </div>
                    <a
                      href={whatsappUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="w-full btn-brand inline-flex items-center justify-center gap-2 py-2.5 text-sm font-black bg-[#25D366] text-white hover:brightness-105 border-2 border-[var(--ink)] rounded-lg"
                    >
                      <MessageCircle size={16} strokeWidth={2.5} />
                      <span>Join {batchTag()} WhatsApp</span>
                      <ExternalLink size={13} strokeWidth={2.5} />
                    </a>
                  </div>
                </Show>

                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  class="btn-brand w-full py-2.5 text-sm font-black cursor-pointer"
                >
                  Continue to Games →
                </button>
              </div>
            </div>
          }
        >
          <form onSubmit={onSubmit} class="card space-y-5">
            {/* Avatar upload */}
            <fieldset class="space-y-3 border-0 p-0">
              <legend class="font-extrabold text-sm">
                Profile Avatar <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
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
                          <span class="text-[9px] font-extrabold uppercase tracking-wide">
                            Photo
                          </span>
                        </div>
                      }
                    >
                      <img
                        src={avatar()!}
                        alt="Avatar preview"
                        class="w-full h-full object-cover"
                      />
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

            {/* 1. Occupation Selector */}
            <div>
              <label class="font-extrabold text-sm block mb-1.5">I am a *</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <For each={occupationValues}>
                  {(occ) => (
                    <button
                      type="button"
                      onClick={() => {
                        setOccupation(occ);
                        if (occ !== "student") {
                          setCollege("other");
                          setBranch("");
                          setBranchOther("");
                          setBatch("na");
                          setDiv("none");
                        } else if (!college()) {
                          setCollege("mec");
                        }
                      }}
                      class={`py-2 px-3 rounded-lg border-2 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        occupation() === occ
                          ? "bg-[var(--ink)] text-white border-[var(--ink)] shadow-sm"
                          : "bg-[var(--paper-2)] text-[var(--ink)] border-[var(--ink-soft)] hover:border-[var(--ink)]"
                      }`}
                    >
                      <Show when={occ === "student"}>
                        <GraduationCap size={15} />
                      </Show>
                      <Show when={occ === "school_student"}>
                        <BookOpen size={15} />
                      </Show>
                      <Show when={occ === "working_professional"}>
                        <Briefcase size={15} />
                      </Show>
                      <Show when={occ === "other"}>
                        <User size={15} />
                      </Show>
                      <span>{occupationLabel(occ)}</span>
                    </button>
                  )}
                </For>
              </div>
              <Show when={fieldError("occupation")}>
                <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                  {fieldError("occupation")}
                </p>
              </Show>
            </div>

            {/* ========================================================================= */}
            {/* A. COLLEGE STUDENT FIELDS */}
            {/* ========================================================================= */}
            <Show when={occupation() === "student"}>
              {/* College Selection */}
              <div>
                <label for="college" class="font-extrabold text-sm block mb-1">
                  College / Institution *
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

              {/* Other College Name Input */}
              <Show when={college() === "other"}>
                <div>
                  <label for="collegeOther" class="font-extrabold text-sm block mb-1">
                    College Name *
                  </label>
                  <input
                    id="collegeOther"
                    value={collegeOther()}
                    onInput={(e) => setCollegeOther(e.currentTarget.value)}
                    placeholder="e.g. CET, CUSAT, NIT Calicut, TKM"
                    maxLength={80}
                    class="input"
                  />
                  <Show when={fieldError("collegeOther")}>
                    <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                      {fieldError("collegeOther")}
                    </p>
                  </Show>
                </div>

                <div>
                  <label for="branchOtherNonMec" class="font-extrabold text-sm block mb-1">
                    Branch / Major <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
                  </label>
                  <input
                    id="branchOtherNonMec"
                    value={branchOther()}
                    onInput={(e) => setBranchOther(e.currentTarget.value)}
                    placeholder="e.g. Computer Science, Architecture, B.Com"
                    maxLength={60}
                    class="input"
                  />
                </div>
              </Show>

              {/* MEC-specific Branch Selection */}
              <Show when={college() === "mec"}>
                <div>
                  <label for="branch" class="font-extrabold text-sm block mb-1">
                    Branch *
                  </label>
                  <select
                    id="branch"
                    value={branch()}
                    onChange={(e) => setBranch(e.currentTarget.value)}
                    class="input font-bold"
                  >
                    <option value="">Select your branch</option>
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

                {/* Custom Branch text if 'other' branch is picked in MEC */}
                <Show when={branch() === "other"}>
                  <div>
                    <label for="branchOther" class="font-extrabold text-sm block mb-1">
                      Which branch? *
                    </label>
                    <input
                      id="branchOther"
                      value={branchOther()}
                      onInput={(e) => setBranchOther(e.currentTarget.value)}
                      placeholder="e.g. Postgraduate, Research"
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
              </Show>

              {/* Batch / Graduation Year */}
              <div>
                <label for="batch" class="font-extrabold text-sm block mb-1">
                  Batch / Year {college() === "mec" ? "*" : "(optional)"}
                </label>
                <select
                  id="batch"
                  value={batch()}
                  onChange={(e) => setBatch(e.currentTarget.value)}
                  class="input font-bold"
                >
                  <option value="">
                    {college() === "mec" ? "Select your batch" : "Select year (optional)"}
                  </option>
                  <For each={activeBatchValues}>
                    {(value) => <option value={value}>{batchLabel(value)}</option>}
                  </For>
                </select>
                <Show when={fieldError("batch")}>
                  <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                    {fieldError("batch")}
                  </p>
                </Show>
              </div>

              {/* Division (Only for MEC students) */}
              <Show when={college() === "mec"}>
                <div>
                  <label for="div" class="font-extrabold text-sm block mb-1">
                    Division <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
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

            {/* ========================================================================= */}
            {/* B. SCHOOL STUDENT FIELDS */}
            {/* ========================================================================= */}
            <Show when={occupation() === "school_student"}>
              <div>
                <label for="schoolName" class="font-extrabold text-sm block mb-1">
                  School Name *
                </label>
                <input
                  id="schoolName"
                  value={collegeOther()}
                  onInput={(e) => setCollegeOther(e.currentTarget.value)}
                  placeholder="e.g. Bhavans Vidya Mandir, Kendriya Vidyalaya"
                  maxLength={80}
                  class="input"
                />
                <Show when={fieldError("collegeOther")}>
                  <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                    {fieldError("collegeOther")}
                  </p>
                </Show>
              </div>

              <div>
                <label for="classGrade" class="font-extrabold text-sm block mb-1">
                  Class / Grade <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
                </label>
                <input
                  id="classGrade"
                  value={branchOther()}
                  onInput={(e) => setBranchOther(e.currentTarget.value)}
                  placeholder="e.g. Class 11, Class 12, 10th Grade"
                  maxLength={60}
                  class="input"
                />
              </div>
            </Show>

            {/* ========================================================================= */}
            {/* C. WORKING PROFESSIONAL FIELDS */}
            {/* ========================================================================= */}
            <Show when={occupation() === "working_professional"}>
              <div>
                <label for="companyName" class="font-extrabold text-sm block mb-1">
                  Company / Organization *
                </label>
                <input
                  id="companyName"
                  value={collegeOther()}
                  onInput={(e) => setCollegeOther(e.currentTarget.value)}
                  placeholder="e.g. Infosys, TCS, Startup, Freelance"
                  maxLength={80}
                  class="input"
                />
                <Show when={fieldError("collegeOther")}>
                  <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                    {fieldError("collegeOther")}
                  </p>
                </Show>
              </div>

              <div>
                <label for="designation" class="font-extrabold text-sm block mb-1">
                  Role / Designation <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
                </label>
                <input
                  id="designation"
                  value={branchOther()}
                  onInput={(e) => setBranchOther(e.currentTarget.value)}
                  placeholder="e.g. Software Engineer, Product Designer"
                  maxLength={60}
                  class="input"
                />
              </div>
            </Show>

            {/* ========================================================================= */}
            {/* D. OTHER / GENERAL FIELDS */}
            {/* ========================================================================= */}
            <Show when={occupation() === "other"}>
              <div>
                <label for="otherOrigin" class="font-extrabold text-sm block mb-1">
                  Where are you from / Community{" "}
                  <span style={{ color: "var(--ink-soft)" }}>(optional)</span>
                </label>
                <input
                  id="otherOrigin"
                  value={collegeOther()}
                  onInput={(e) => setCollegeOther(e.currentTarget.value)}
                  placeholder="e.g. Kochi, Open Source Enthusiast, Self-taught Dev"
                  maxLength={80}
                  class="input"
                />
              </div>
            </Show>

            {/* 5. Instagram with Live Link Preview */}
            <div class="space-y-1.5">
              <label for="instagram" class="font-extrabold text-sm block mb-1">
                Instagram handle{" "}
                <span style={{ color: "var(--ink-soft)" }}>
                  (optional, for winner tags & share cards)
                </span>
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3 text-sm font-black text-[var(--ink-soft)]">@</span>
                <input
                  id="instagram"
                  type="text"
                  value={instagram()}
                  onInput={(e) => setInstagram(e.currentTarget.value)}
                  placeholder="username"
                  class="input pl-8"
                />
              </div>

              {/* Live Instagram Link Preview */}
              <Show when={cleanInstagram()}>
                <div class="mt-2 flex items-center justify-between rounded-lg p-2.5 bg-[var(--paper-2)] border-2 border-[var(--ink)]">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="p-1.5 rounded-md bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white shrink-0">
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        stroke="currentColor"
                        stroke-width="2"
                        fill="none"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <p class="font-black text-xs truncate">@{cleanInstagram()}</p>
                      <p class="text-[10px] font-semibold text-[var(--ink-soft)] truncate">
                        instagram.com/{cleanInstagram()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://instagram.com/${cleanInstagram()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-ghost py-1 px-2 text-xs font-black flex items-center gap-1 shrink-0"
                    title="Open Instagram profile in new tab"
                  >
                    <span>Preview</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </Show>

              <Show when={fieldError("instagramHandle")}>
                <p class="mt-1 font-extrabold text-xs" style={{ color: "var(--pop-red)" }}>
                  {fieldError("instagramHandle")}
                </p>
              </Show>
            </div>

            {/* WhatsApp */}
            <div>
              <label for="whatsapp" class="font-extrabold text-sm block mb-1">
                WhatsApp / Mobile number *{" "}
                <span style={{ color: "var(--ink-soft)" }}>
                  (10-digit Indian number for prize delivery)
                </span>
              </label>
              <input
                id="whatsapp"
                type="tel"
                value={whatsapp()}
                onInput={(e) => setWhatsapp(e.currentTarget.value)}
                placeholder="98765 43210"
                required
                class="input font-mono"
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
        </Show>

        <Show when={!justCompleted() && !!me()?.onboardingCompleted && !!whatsappUrl()}>
          <div class="card pop-yellow p-4 sm:p-5 space-y-3 border-2 border-[var(--ink)]">
            <div class="flex items-start gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-[#25D366] border-2 border-[var(--ink)] grid place-items-center shrink-0">
                <MessageCircle size={16} strokeWidth={2.5} color="white" />
              </div>
              <div class="min-w-0 flex-1">
                <p
                  class="m-0 text-xs font-black uppercase tracking-wide"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Exclusive for {batchName()}
                </p>
                <h3 class="m-0 text-sm sm:text-base font-black leading-tight">
                  Join the FOSS MEC {batchTag()} WhatsApp group
                </h3>
                <p
                  class="m-0 text-xs font-semibold leading-relaxed"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Connect with your batchmates, get clues & launch updates.
                </p>
              </div>
            </div>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              class="w-full btn-brand inline-flex items-center justify-center gap-2 py-2.5 text-sm font-black bg-[#25D366] text-white hover:brightness-105 border-2 border-[var(--ink)] rounded-lg"
            >
              <MessageCircle size={16} strokeWidth={2.5} />
              <span>Join {batchTag()} WhatsApp</span>
              <ExternalLink size={13} strokeWidth={2.5} />
            </a>
          </div>
        </Show>
      </div>
    </main>
  );
}
