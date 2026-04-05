/**
 * Department Templates — pre-built harness configurations for 8 department types.
 *
 * Each template defines:
 * - Recommended asset names and descriptions (to seed during onboarding)
 * - Default tags for discoverability
 * - Suggested rules content (markdown)
 *
 * Templates are NOT stored in the database — they're code constants used during
 * department creation. Assets generated from templates ARE stored as real assets.
 *
 * Per V2-MASTER-PLAN: "204 skills across 13 departments already exist" in community.
 * We provide starter content for the 8 most common department types.
 */

import type { DepartmentType } from "@/types/organization";
import type { AssetType } from "@/types/asset";

/** A single asset template within a department harness */
export interface AssetTemplate {
  name: string;
  description: string;
  type: AssetType;
  tags: string[];
  /** Starter content (markdown or JSON string) */
  content: string;
}

/** Full department harness template */
export interface DepartmentTemplate {
  type: DepartmentType;
  displayName: string;
  description: string;
  icon: string;
  assets: AssetTemplate[];
}

/** All department templates indexed by type */
const TEMPLATES: Record<Exclude<DepartmentType, "custom">, DepartmentTemplate> = {
  engineering_fe: {
    type: "engineering_fe",
    displayName: "Frontend Engineering",
    description: "React, TypeScript, accessibility, and performance standards for frontend teams.",
    icon: "Monitor",
    assets: [
      {
        name: "Frontend Code Standards",
        description: "TypeScript strict mode, component patterns, accessibility requirements",
        type: "rule",
        tags: ["frontend", "typescript", "react", "accessibility"],
        content: "# Frontend Code Standards\n\n## TypeScript\n- Strict mode enabled\n- No `any` types\n- Interfaces over type aliases for object shapes\n\n## React\n- Server Components by default\n- `'use client'` only when needed (interactivity, hooks, browser APIs)\n- No barrel files — import directly from source\n\n## Accessibility\n- WCAG 2.1 AA compliance required\n- 44px minimum touch targets\n- `prefers-reduced-motion` honored\n- Semantic HTML over div soup\n\n## Performance\n- Bundle size budgets enforced\n- `next/dynamic` for heavy components\n- `Promise.all()` for parallel operations\n",
      },
      {
        name: "Component Review Checklist",
        description: "Pre-merge checklist for React component PRs",
        type: "skill",
        tags: ["frontend", "review", "checklist"],
        content: "# Component Review Checklist\n\nBefore approving any component PR:\n\n1. **Types**: No `any`, proper generics, exported interfaces\n2. **States**: Error → Loading → Empty → Data order\n3. **A11y**: aria-labels, keyboard nav, screen reader tested\n4. **Perf**: No unnecessary re-renders, memoized callbacks\n5. **Tests**: Unit + integration, >80% coverage\n6. **Bundle**: No barrel imports, lazy load if >50KB\n",
      },
    ],
  },
  engineering_be: {
    type: "engineering_be",
    displayName: "Backend Engineering",
    description: "API design, database patterns, security, and reliability standards.",
    icon: "Server",
    assets: [
      {
        name: "API Design Standards",
        description: "RESTful API patterns, error handling, input validation",
        type: "rule",
        tags: ["backend", "api", "security", "rest"],
        content: "# API Design Standards\n\n## Authentication\n- All routes require authentication unless explicitly public\n- Use bearer tokens or session cookies\n- Rate limiting on all endpoints\n\n## Input Validation\n- Validate ALL input at the boundary\n- Use Zod or similar for runtime validation\n- Never trust client-side validation alone\n\n## Error Handling\n- Consistent error response format: `{ error: string, details?: object }`\n- Never expose internal errors to clients\n- Log all 5xx errors with context\n\n## Database\n- Connection pooling with singleton pattern\n- Parameterized queries only — no string concatenation\n- Index coverage verified with explain()\n",
      },
    ],
  },
  devops: {
    type: "devops",
    displayName: "DevOps & Platform",
    description: "Infrastructure, CI/CD, monitoring, and deployment standards.",
    icon: "Container",
    assets: [
      {
        name: "Deployment Standards",
        description: "CI/CD pipeline requirements, rollback procedures, monitoring",
        type: "rule",
        tags: ["devops", "ci-cd", "deployment", "monitoring"],
        content: "# Deployment Standards\n\n## CI/CD\n- All deployments through pipeline — no manual deploys\n- Tests must pass before merge\n- Staged rollouts: dev → staging → production\n\n## Monitoring\n- Health check endpoints on all services\n- Alert on error rate > 1%\n- Dashboard for key business metrics\n\n## Rollback\n- One-click rollback capability\n- Database migrations must be reversible\n- Feature flags for gradual rollout\n",
      },
    ],
  },
  sales: {
    type: "sales",
    displayName: "Sales",
    description: "CRM workflows, discovery frameworks, and outreach templates.",
    icon: "TrendingUp",
    assets: [
      {
        name: "Discovery Framework",
        description: "MEDDPICC-based discovery call structure and note-taking",
        type: "skill",
        tags: ["sales", "discovery", "meddpicc"],
        content: "# Discovery Framework\n\nUse MEDDPICC for qualification:\n\n- **M**etrics: What KPIs does this impact?\n- **E**conomic Buyer: Who controls budget?\n- **D**ecision Criteria: How will they evaluate?\n- **D**ecision Process: What's the timeline?\n- **P**aper Process: Legal/procurement steps?\n- **I**mplicate Pain: What happens if they don't act?\n- **C**hampion: Who's advocating internally?\n- **C**ompetition: Who else are they evaluating?\n",
      },
    ],
  },
  product: {
    type: "product",
    displayName: "Product Management",
    description: "PRD templates, user story standards, and prioritization frameworks.",
    icon: "Layout",
    assets: [],
  },
  legal: {
    type: "legal",
    displayName: "Legal & Compliance",
    description: "Contract review guidelines, compliance checklists, and policy templates.",
    icon: "Scale",
    assets: [],
  },
  marketing: {
    type: "marketing",
    displayName: "Marketing",
    description: "Brand voice guidelines, content templates, and campaign standards.",
    icon: "Megaphone",
    assets: [],
  },
  support: {
    type: "support",
    displayName: "Customer Support",
    description: "Ticket triage rules, escalation procedures, and response templates.",
    icon: "HeadphonesIcon",
    assets: [],
  },
};


/**
 * Get a department template by type.
 * Returns undefined for "custom" type (no template).
 */
export function getDepartmentTemplate(type: DepartmentType): DepartmentTemplate | undefined {
  if (type === "custom") return undefined;
  return TEMPLATES[type];
}

/**
 * Get all available department templates.
 */
export function getAllDepartmentTemplates(): DepartmentTemplate[] {
  return Object.values(TEMPLATES);
}

/**
 * Get template display info (no asset content) for selection UI.
 */
export function getDepartmentTemplateSummaries(): Array<{
  type: DepartmentType;
  displayName: string;
  description: string;
  icon: string;
  assetCount: number;
}> {
  return Object.values(TEMPLATES).map((t) => ({
    type: t.type,
    displayName: t.displayName,
    description: t.description,
    icon: t.icon,
    assetCount: t.assets.length,
  }));
}
