"use client";

/**
 * OnboardingWizard — 5-step interactive client form.
 * Step 1: Organization name
 * Step 2: Department type (grid of cards)
 * Step 3: Team name + agent tooling
 * Step 4: Scale + workflow preference
 * Step 5: Review + confirm
 * On submit: POST /api/onboarding → redirect to /dashboard
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Building2, Users, Briefcase, Settings, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import type { AgentTooling, TeamScale, WorkflowPreference } from "@/services/onboarding-service";

const DEPT_OPTIONS = [
  { value: "engineering_fe", label: "Frontend Engineering", icon: "🖥️" },
  { value: "engineering_be", label: "Backend Engineering", icon: "⚙️" },
  { value: "devops", label: "DevOps / Platform", icon: "🚀" },
  { value: "data_science", label: "Data Science", icon: "📊" },
  { value: "product", label: "Product", icon: "📋" },
  { value: "design", label: "Design", icon: "🎨" },
  { value: "qa", label: "Quality Assurance", icon: "✅" },
  { value: "sales", label: "Sales", icon: "💰" },
  { value: "support", label: "Support", icon: "🎧" },
  { value: "custom", label: "Custom / Other", icon: "⚡" },
] as const;

const TOOLING_OPTIONS: { value: AgentTooling; label: string; desc: string }[] = [
  { value: "claude-code", label: "Claude Code", desc: "Anthropic's agentic coding assistant" },
  { value: "cursor", label: "Cursor", desc: "AI-first code editor" },
  { value: "copilot", label: "GitHub Copilot", desc: "GitHub's AI pair programmer" },
  { value: "windsurf", label: "Windsurf", desc: "Codeium's AI IDE" },
  { value: "codex", label: "OpenAI Codex", desc: "OpenAI's coding agent" },
  { value: "multiple", label: "Multiple agents", desc: "We use several AI tools" },
  { value: "undecided", label: "Not sure yet", desc: "Still evaluating options" },
];

const SCALE_OPTIONS: { value: TeamScale; label: string; desc: string }[] = [
  { value: "solo", label: "Just me", desc: "Solo developer" },
  { value: "small", label: "2–5 people", desc: "Small team" },
  { value: "medium", label: "6–20 people", desc: "Medium team" },
  { value: "large", label: "20+ people", desc: "Large organization" },
];

const WORKFLOW_OPTIONS: { value: WorkflowPreference; label: string; desc: string }[] = [
  { value: "move_fast", label: "Move fast", desc: "Auto-approve, minimal review" },
  { value: "balanced", label: "Balanced", desc: "Single reviewer before publish" },
  { value: "strict_review", label: "Strict review", desc: "Multi-reviewer, all changes approved" },
];

const TOTAL_STEPS = 5;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [deptType, setDeptType] = useState("engineering_fe");
  const [teamName, setTeamName] = useState("");
  const [tooling, setTooling] = useState<AgentTooling>("claude-code");
  const [scale, setScale] = useState<TeamScale>("small");
  const [workflow, setWorkflow] = useState<WorkflowPreference>("balanced");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canProceed =
    step === 1 ? orgName.trim().length >= 2
    : step === 2 ? !!deptType
    : step === 3 ? teamName.trim().length >= 2 && !!tooling
    : step === 4 ? !!scale && !!workflow
    : true; // step 5 = review

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: orgName.trim(),
          deptType,
          teamName: teamName.trim(),
          tooling,
          scale,
          workflow,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }, [orgName, deptType, teamName, tooling, scale, workflow, router]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              s === step ? "bg-blue-600 text-white" : s < step ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}>
              {s < step ? "✓" : s}
            </div>
            {s < TOTAL_STEPS && <div className={`h-0.5 w-6 transition-colors ${s < step ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Org name */}
      {step === 1 && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Building2 className="h-5 w-5 text-blue-600" />
            Name your organization
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">This is your company or team workspace.</p>
          <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Corp" autoFocus
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-800" />
        </div>
      )}

      {/* Step 2: Department type */}
      {step === 2 && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Briefcase className="h-5 w-5 text-blue-600" />
            What kind of team?
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">We&apos;ll set up starter configs for your department.</p>
          <div className="grid grid-cols-2 gap-2">
            {DEPT_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setDeptType(opt.value)}
                className={`cursor-pointer rounded-lg border p-3 text-left text-sm transition-all ${
                  deptType === opt.value
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}>
                <span className="mr-1.5">{opt.icon}</span>
                <span className="font-medium text-gray-900 dark:text-white">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Team name + Tooling */}
      {step === 3 && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Users className="h-5 w-5 text-blue-600" />
            Team setup
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Name your first team and pick your primary AI agent.</p>
          <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)}
            placeholder="Platform Team" autoFocus
            className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-800" />
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Primary agent tooling</p>
          <div className="grid grid-cols-2 gap-2">
            {TOOLING_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setTooling(opt.value)}
                className={`cursor-pointer rounded-lg border p-3 text-left transition-all ${
                  tooling === opt.value
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Scale + Workflow */}
      {step === 4 && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Settings className="h-5 w-5 text-blue-600" />
            How does your team work?
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">We&apos;ll configure review policies and approval workflows.</p>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Team size</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {SCALE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setScale(opt.value)}
                className={`cursor-pointer rounded-lg border p-3 text-left transition-all ${
                  scale === opt.value
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
              </button>
            ))}
          </div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Review workflow</p>
          <div className="grid grid-cols-1 gap-2">
            {WORKFLOW_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setWorkflow(opt.value)}
                className={`cursor-pointer rounded-lg border p-3 text-left transition-all ${
                  workflow === opt.value
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Review your setup
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Confirm everything looks right before we create your workspace.</p>
          <div className="space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            {[
              { label: "Organization", value: orgName },
              { label: "Department", value: DEPT_OPTIONS.find((d) => d.value === deptType)?.label ?? deptType },
              { label: "Team", value: teamName },
              { label: "Primary Agent", value: TOOLING_OPTIONS.find((t) => t.value === tooling)?.label ?? tooling },
              { label: "Team Size", value: SCALE_OPTIONS.find((s) => s.value === scale)?.label ?? scale },
              { label: "Workflow", value: WORKFLOW_OPTIONS.find((w) => w.value === workflow)?.label ?? workflow },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{label}</span>
                <span className="font-medium text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 1}
          className="flex cursor-pointer items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:invisible dark:text-gray-400 dark:hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < TOTAL_STEPS ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canProceed}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={!canProceed || submitting}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</> : "Create Workspace"}
          </button>
        )}
      </div>
    </div>
  );
}
