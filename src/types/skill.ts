/**
 * @deprecated — Use types from "@/types/asset" instead.
 * This file re-exports for backward compatibility during migration.
 */

import type {
  AssetMetadata,
  AssetSource,
  SkillAsset,
  CreateAssetInput,
} from "./asset";

/** @deprecated Use AssetMetadata */
export type SkillMetadata = AssetMetadata;

/** @deprecated Use AssetSource */
export type SkillSource = AssetSource;

/** @deprecated Use SkillAsset (or AssetDocument union) */
export type SkillDocument = SkillAsset;

/** @deprecated Use CreateAssetInput */
export type CreateSkillInput = CreateAssetInput;
