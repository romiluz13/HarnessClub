"use client";

/**
 * SSO Configuration page — SAML 2.0 / OIDC setup.
 * Reads/writes from real /api/orgs/[orgId]/sso endpoint.
 */

import { useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useActiveOrg } from "@/lib/hooks/use-active-org";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SAML_PRESETS = [
  { value: "okta", label: "Okta" },
  { value: "azure_ad", label: "Azure AD" },
  { value: "onelogin", label: "OneLogin" },
  { value: "custom", label: "Custom" },
] as const;

const OIDC_PRESETS = [
  { value: "google", label: "Google" },
  { value: "auth0", label: "Auth0" },
  { value: "azure_ad", label: "Azure AD" },
  { value: "custom", label: "Custom" },
] as const;

type EditableSsoConfig = {
  providerType?: "saml" | "oidc";
  providerPreset?: string;
  jitProvisioning?: boolean;
  enforceSSO?: boolean;
  updatedAt?: string;
  saml?: {
    entityId?: string;
    ssoUrl?: string;
    certificate?: string;
  } | null;
  oidc?: {
    issuer?: string;
    clientId?: string;
    hasClientSecret?: boolean;
  } | null;
} | null;

function getInitialFormState(sso: EditableSsoConfig) {
  const provider = sso?.providerType ?? "saml";
  return {
    provider,
    providerPreset: sso?.providerPreset ?? (provider === "oidc" ? "google" : "okta"),
    entityId: sso?.saml?.entityId ?? "",
    ssoUrl: sso?.saml?.ssoUrl ?? "",
    certificate: sso?.saml?.certificate ?? "",
    issuer: sso?.oidc?.issuer ?? "",
    clientId: sso?.oidc?.clientId ?? "",
    clientSecret: "",
    hasClientSecret: Boolean(sso?.oidc?.hasClientSecret),
    enforced: sso?.enforceSSO ?? false,
    jitProvisioning: sso?.jitProvisioning ?? true,
  } as const;
}

function SsoForm({ orgId, initialSso }: { orgId: string; initialSso: EditableSsoConfig }) {
  const initialState = getInitialFormState(initialSso);
  const [provider, setProvider] = useState<"saml" | "oidc">(initialState.provider);
  const [providerPreset, setProviderPreset] = useState<string>(initialState.providerPreset);
  const [entityId, setEntityId] = useState(initialState.entityId);
  const [ssoUrl, setSsoUrl] = useState(initialState.ssoUrl);
  const [certificate, setCertificate] = useState(initialState.certificate);
  const [issuer, setIssuer] = useState(initialState.issuer);
  const [clientId, setClientId] = useState(initialState.clientId);
  const [clientSecret, setClientSecret] = useState<string>(initialState.clientSecret);
  const [hasClientSecret, setHasClientSecret] = useState(initialState.hasClientSecret);
  const [enforced, setEnforced] = useState(initialState.enforced);
  const [jitProvisioning, setJitProvisioning] = useState(initialState.jitProvisioning);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presetOptions = useMemo(
    () => (provider === "saml" ? SAML_PRESETS : OIDC_PRESETS),
    [provider]
  );

  const switchProvider = useCallback((nextProvider: "saml" | "oidc") => {
    setProvider(nextProvider);
    setProviderPreset(nextProvider === "saml" ? "okta" : "google");
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    const payload = provider === "saml"
      ? {
          providerType: "saml",
          providerPreset,
          jitProvisioning,
          enforceSSO: enforced,
          saml: {
            entityId,
            ssoUrl,
            certificate,
          },
        }
      : {
          providerType: "oidc",
          providerPreset,
          jitProvisioning,
          enforceSSO: enforced,
          oidc: {
            issuer,
            clientId,
            clientSecret,
          },
        };

    const response = await fetch(`/api/orgs/${orgId}/sso`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setSaving(false);
      setError(body?.error ?? "Failed to save SSO configuration");
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (provider === "oidc" && clientSecret.length > 0) {
      setHasClientSecret(true);
      setClientSecret("");
    }
  }, [orgId, provider, providerPreset, entityId, ssoUrl, certificate, issuer, clientId, clientSecret, enforced, jitProvisioning]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex gap-2">
        {(["saml", "oidc"] as const).map((p) => (
          <button key={p} type="button" onClick={() => switchProvider(p)}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium ${provider === p ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {provider === "saml" ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
              <select
                value={providerPreset}
                onChange={(e) => setProviderPreset(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {presetOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Entity ID</label>
              <input type="text" value={entityId} onChange={(e) => setEntityId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">SSO URL</label>
              <input type="url" value={ssoUrl} onChange={(e) => setSsoUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Certificate</label>
              <textarea
                value={certificate}
                onChange={(e) => setCertificate(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="-----BEGIN CERTIFICATE-----"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
              <select
                value={providerPreset}
                onChange={(e) => setProviderPreset(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {presetOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Issuer URL</label>
              <input type="url" value={issuer} onChange={(e) => setIssuer(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Client ID</label>
              <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={hasClientSecret ? "Saved secret will be kept if left blank" : ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={enforced} onChange={(e) => setEnforced(e.target.checked)} className="cursor-pointer" />
            Enforce SSO (disable password login)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={jitProvisioning} onChange={(e) => setJitProvisioning(e.target.checked)} className="cursor-pointer" />
            JIT Provisioning
          </label>
        </div>

        {error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Configuration
        </button>
        {saved && <span role="status" aria-live="polite" className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
      </div>
    </div>
  );
}

export default function SsoPage() {
  const { orgId, loading: orgLoading } = useActiveOrg();
  const { data: ssoData, isLoading } = useSWR(orgId ? `/api/orgs/${orgId}/sso` : null, fetcher);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Single Sign-On</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configure SAML 2.0 or OIDC</p>
        </div>
      </div>

      {isLoading || orgLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !orgId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          Create or join an organization before configuring SSO.
        </div>
      ) : (
        <SsoForm key={ssoData?.sso?.updatedAt ?? "empty"} orgId={orgId} initialSso={ssoData?.sso ?? null} />
      )}
    </div>
  );
}
