/**
 * GET /api/orgs/:orgId/sso — Get SSO config for organization.
 * PUT /api/orgs/:orgId/sso — Create or update SSO config.
 * DELETE /api/orgs/:orgId/sso — Disable SSO.
 *
 * Per api-security-best-practices: auth + org owner/admin RBAC required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getOrgRole, requireAuth } from "@/lib/api-helpers";
import { hasOrgPermission } from "@/lib/rbac";
import { getOrgById } from "@/services/org-service";
import {
  getSsoConfig,
  migrateOidcSecretIfNeeded,
  upsertSsoConfig,
  disableSso,
  isSsoEnforced,
} from "@/services/sso-service";
import type { GroupMapping, SsoConfigDocument, SsoProviderType, SsoProviderPreset } from "@/types/sso";

const VALID_PROVIDER_TYPES: SsoProviderType[] = ["saml", "oidc"];
const VALID_PRESETS: SsoProviderPreset[] = [
  "okta",
  "azure_ad",
  "onelogin",
  "google",
  "auth0",
  "custom",
];

function defaultPresetFor(providerType: SsoProviderType): SsoProviderPreset {
  return providerType === "saml" ? "okta" : "google";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function serializeGroupMappings(groupMappings: SsoConfigDocument["groupMappings"]) {
  return groupMappings.map((mapping) => ({
    idpGroup: mapping.idpGroup,
    orgId: mapping.orgId.toHexString(),
    departmentId: mapping.departmentId?.toHexString(),
    teamId: mapping.teamId?.toHexString(),
    role: mapping.role,
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const orgRole = await getOrgRole(db, userId, orgOid);
  if (!orgRole || !hasOrgPermission(orgRole, "org:read")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const config = await getSsoConfig(db, orgOid);
  if (!config) {
    return NextResponse.json({ sso: null, enforced: false });
  }
  const hydratedConfig = await migrateOidcSecretIfNeeded(db, config);

  return NextResponse.json({
    sso: {
      id: hydratedConfig._id.toHexString(),
      providerType: hydratedConfig.providerType,
      providerPreset: hydratedConfig.providerPreset,
      enabled: hydratedConfig.enabled,
      jitProvisioning: hydratedConfig.jitProvisioning,
      enforceSSO: hydratedConfig.enforceSSO,
      autoDeactivate: hydratedConfig.autoDeactivate,
      groupMappings: serializeGroupMappings(hydratedConfig.groupMappings),
      saml: hydratedConfig.saml ? {
        entityId: hydratedConfig.saml.entityId,
        ssoUrl: hydratedConfig.saml.ssoUrl,
        sloUrl: hydratedConfig.saml.sloUrl,
        certificate: hydratedConfig.saml.certificate,
        spEntityId: hydratedConfig.saml.spEntityId,
        nameIdFormat: hydratedConfig.saml.nameIdFormat,
        attributeMapping: hydratedConfig.saml.attributeMapping,
      } : null,
      oidc: hydratedConfig.oidc ? {
        issuer: hydratedConfig.oidc.issuer,
        clientId: hydratedConfig.oidc.clientId,
        scopes: hydratedConfig.oidc.scopes,
        claimMapping: hydratedConfig.oidc.claimMapping,
        hasClientSecret: !!hydratedConfig.oidc.clientSecretEncrypted,
      } : null,
      createdAt: hydratedConfig.createdAt.toISOString(),
      updatedAt: hydratedConfig.updatedAt.toISOString(),
    },
    enforced: await isSsoEnforced(db, orgOid),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { providerType, providerPreset, saml, oidc, groupMappings, jitProvisioning, enforceSSO } = body;

  const normalizedProviderType = (
    (typeof providerType === "string" && providerType)
    || (typeof body.provider === "string" && body.provider)
  ) as SsoProviderType | undefined;

  if (!normalizedProviderType || !VALID_PROVIDER_TYPES.includes(normalizedProviderType)) {
    return NextResponse.json(
      { error: `providerType must be one of: ${VALID_PROVIDER_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const normalizedProviderPreset = (
    (typeof providerPreset === "string" && providerPreset)
    || (typeof body.providerPreset === "string" && body.providerPreset)
    || defaultPresetFor(normalizedProviderType)
  ) as SsoProviderPreset;

  if (!VALID_PRESETS.includes(normalizedProviderPreset)) {
    return NextResponse.json(
      { error: `providerPreset must be one of: ${VALID_PRESETS.join(", ")}` },
      { status: 400 }
    );
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const orgRole = await getOrgRole(db, userId, orgOid);
  if (!orgRole || !hasOrgPermission(orgRole, "org:update")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const existingConfig = await getSsoConfig(db, orgOid);

  const normalizedSamlInput = isRecord(saml) ? saml : body;
  const normalizedOidcInput = isRecord(oidc) ? oidc : body;

  const nextSaml = normalizedProviderType === "saml"
    ? {
        entityId: String(normalizedSamlInput.entityId ?? ""),
        ssoUrl: String(normalizedSamlInput.ssoUrl ?? ""),
        sloUrl: typeof normalizedSamlInput.sloUrl === "string" ? normalizedSamlInput.sloUrl : undefined,
        certificate: typeof normalizedSamlInput.certificate === "string"
          ? normalizedSamlInput.certificate
          : existingConfig?.saml?.certificate ?? "",
        spEntityId: typeof normalizedSamlInput.spEntityId === "string"
          ? normalizedSamlInput.spEntityId
          : existingConfig?.saml?.spEntityId ?? `${new URL(request.url).origin}/api/auth/saml`,
        nameIdFormat: (normalizedSamlInput.nameIdFormat as "email" | "persistent" | "transient" | undefined)
          ?? existingConfig?.saml?.nameIdFormat
          ?? "email",
        attributeMapping: isRecord(normalizedSamlInput.attributeMapping)
          ? {
              email: String(normalizedSamlInput.attributeMapping.email ?? "email"),
              firstName: typeof normalizedSamlInput.attributeMapping.firstName === "string" ? normalizedSamlInput.attributeMapping.firstName : "firstName",
              lastName: typeof normalizedSamlInput.attributeMapping.lastName === "string" ? normalizedSamlInput.attributeMapping.lastName : "lastName",
              groups: typeof normalizedSamlInput.attributeMapping.groups === "string" ? normalizedSamlInput.attributeMapping.groups : "groups",
              department: typeof normalizedSamlInput.attributeMapping.department === "string" ? normalizedSamlInput.attributeMapping.department : "department",
            }
          : existingConfig?.saml?.attributeMapping ?? { email: "email", firstName: "firstName", lastName: "lastName", groups: "groups", department: "department" },
      }
    : undefined;

  if (normalizedProviderType === "saml" && (!nextSaml?.entityId || !nextSaml.ssoUrl || !nextSaml.certificate)) {
    return NextResponse.json(
      { error: "SAML configuration requires entityId, ssoUrl, and certificate" },
      { status: 400 }
    );
  }

  const nextOidc = normalizedProviderType === "oidc"
    ? {
        issuer: String(normalizedOidcInput.issuer ?? ""),
        clientId: String(normalizedOidcInput.clientId ?? ""),
        clientSecretEncrypted: typeof normalizedOidcInput.clientSecret === "string" && normalizedOidcInput.clientSecret.length > 0
          ? normalizedOidcInput.clientSecret
          : existingConfig?.oidc?.clientSecretEncrypted ?? "",
        scopes: Array.isArray(normalizedOidcInput.scopes)
          ? normalizedOidcInput.scopes.filter((value): value is string => typeof value === "string" && value.length > 0)
          : existingConfig?.oidc?.scopes ?? ["openid", "email", "profile"],
        claimMapping: isRecord(normalizedOidcInput.claimMapping)
          ? {
              email: String(normalizedOidcInput.claimMapping.email ?? "email"),
              name: typeof normalizedOidcInput.claimMapping.name === "string" ? normalizedOidcInput.claimMapping.name : "name",
              groups: typeof normalizedOidcInput.claimMapping.groups === "string" ? normalizedOidcInput.claimMapping.groups : "groups",
            }
          : existingConfig?.oidc?.claimMapping ?? { email: "email", name: "name", groups: "groups" },
      }
    : undefined;

  if (normalizedProviderType === "oidc" && (!nextOidc?.issuer || !nextOidc.clientId || !nextOidc.clientSecretEncrypted)) {
    return NextResponse.json(
      { error: "OIDC configuration requires issuer, clientId, and clientSecret" },
      { status: 400 }
    );
  }

  const result = await upsertSsoConfig(db, orgOid, {
    providerType: normalizedProviderType,
    providerPreset: normalizedProviderPreset,
    saml: nextSaml,
    oidc: nextOidc,
    groupMappings: Array.isArray(groupMappings) ? groupMappings as GroupMapping[] : existingConfig?.groupMappings,
    jitProvisioning: jitProvisioning as boolean | undefined,
    enforceSSO: enforceSSO as boolean | undefined,
  });

  return NextResponse.json(
    { configId: result.configId?.toHexString(), message: "SSO configuration saved" },
    { status: 200 }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const orgRole = await getOrgRole(db, userId, orgOid);
  if (!orgRole || !hasOrgPermission(orgRole, "org:update")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  await disableSso(db, orgOid);

  return NextResponse.json({ message: "SSO disabled" });
}
