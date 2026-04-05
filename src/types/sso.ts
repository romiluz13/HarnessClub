/**
 * SSO / SAML / OIDC type definitions.
 *
 * Supports:
 * - SAML 2.0 (Okta, Azure AD, OneLogin)
 * - OIDC (Google, Auth0, custom)
 *
 * Per api-security-best-practices:
 * - Never store private keys in application code
 * - Certificates stored encrypted at rest (MongoDB Atlas AES-256)
 * - Session binding to prevent replay attacks
 */

import type { ObjectId } from "mongodb";

/** Supported SSO provider types */
export type SsoProviderType = "saml" | "oidc";

/** Known SSO provider presets */
export type SsoProviderPreset =
  | "okta"
  | "azure_ad"
  | "onelogin"
  | "google"
  | "auth0"
  | "custom";

/** SAML 2.0 configuration */
export interface SamlConfig {
  /** IdP Entity ID (e.g., https://sso.okta.com/app/xyz) */
  entityId: string;
  /** IdP SSO URL */
  ssoUrl: string;
  /** IdP SLO URL (optional) */
  sloUrl?: string;
  /** IdP certificate (PEM format) for signature validation */
  certificate: string;
  /** SP Entity ID (our callback URL) */
  spEntityId: string;
  /** Name ID format */
  nameIdFormat: "email" | "persistent" | "transient";
  /** Attribute mapping: IdP attribute → our field */
  attributeMapping: {
    email: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
    department?: string;
  };
}

/** OIDC configuration */
export interface OidcConfig {
  /** OIDC Discovery URL */
  issuer: string;
  /** Client ID */
  clientId: string;
  /** Client Secret (stored encrypted) */
  clientSecretEncrypted: string;
  /** Scopes to request */
  scopes: string[];
  /** Claim mapping */
  claimMapping: {
    email: string;
    name?: string;
    groups?: string;
  };
}

/** Group → org/dept/team mapping rule */
export interface GroupMapping {
  /** IdP group name or pattern */
  idpGroup: string;
  /** Target organization */
  orgId: ObjectId;
  /** Target department (optional) */
  departmentId?: ObjectId;
  /** Target team (optional) */
  teamId?: ObjectId;
  /** Role to assign */
  role: string;
}

/** Full SSO configuration document (per org) */
export interface SsoConfigDocument {
  _id: ObjectId;
  /** Organization this SSO config belongs to */
  orgId: ObjectId;
  /** Provider type */
  providerType: SsoProviderType;
  /** Provider preset (for UI display) */
  providerPreset: SsoProviderPreset;
  /** Enabled status */
  enabled: boolean;
  /** SAML config (if providerType === 'saml') */
  saml?: SamlConfig;
  /** OIDC config (if providerType === 'oidc') */
  oidc?: OidcConfig;
  /** IdP group → org/dept/team mappings */
  groupMappings: GroupMapping[];
  /** JIT provisioning enabled */
  jitProvisioning: boolean;
  /** Auto-deactivate users removed from IdP */
  autoDeactivate: boolean;
  /** Enforce SSO-only login (disable password) */
  enforceSSO: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** JIT provisioned user event */
export interface JitProvisionEvent {
  email: string;
  name: string;
  idpGroups: string[];
  mappedOrg: ObjectId;
  mappedDepartment?: ObjectId;
  mappedTeam?: ObjectId;
  mappedRole: string;
  provisionedAt: Date;
}
