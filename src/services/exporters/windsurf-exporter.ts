/**
 * Windsurf Exporter — .windsurfrules format.
 *
 * Windsurf uses a single flat text file (.windsurfrules) at project root.
 * All text-based assets are flattened into instruction blocks.
 * Uses comment-style headers to separate sections.
 */

import { registerExporter } from "./registry";
import type { ExporterPlugin, ExportedFile } from "./types";
import type { AssetDocument } from "@/types/asset";

const windsurfExporter: ExporterPlugin = {
  id: "windsurf",
  name: "Windsurf",
  target: "windsurf",
  supportedTypes: ["skill", "agent", "rule"],

  export(asset: AssetDocument): ExportedFile {
    const header = `# ${asset.metadata.name}\n# ${asset.metadata.description}\n\n`;
    const content = header + asset.content;

    return {
      filename: ".windsurfrules",
      content,
      mimeType: "text/plain",
      sourceType: asset.type,
      target: "windsurf",
    };
  },
};

registerExporter(windsurfExporter);
