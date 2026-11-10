export const MAX_LOCAL_GLB_BYTES = 50 * 1024 * 1024;

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;

export type GlbDocument = {
  asset?: { version?: string };
  buffers?: Array<{ uri?: string }>;
  images?: Array<{ uri?: string }>;
  [key: string]: unknown;
};

/**
 * Validates a self-contained GLB v2 before handing it to a loader.
 * In particular, external buffer/image URIs are rejected so loading cannot
 * trigger requests to arbitrary hosts or local-network services.
 */
export function validateLocalGlb(buffer: ArrayBuffer): GlbDocument {
  if (buffer.byteLength < 20) {
    throw new Error("This file is too small to be a valid GLB model.");
  }
  if (buffer.byteLength > MAX_LOCAL_GLB_BYTES) {
    throw new Error("GLB files must be 50 MB or smaller.");
  }

  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("The selected file is not a GLB binary model.");
  }
  if (view.getUint32(4, true) !== 2) {
    throw new Error("Only GLB version 2 files are supported.");
  }
  if (view.getUint32(8, true) !== buffer.byteLength) {
    throw new Error("The GLB file has an invalid declared length.");
  }

  let offset = 12;
  let jsonDocument: GlbDocument | undefined;
  let chunkIndex = 0;

  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) {
      throw new Error("The GLB file contains a truncated chunk header.");
    }
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkLength % 4 !== 0 || chunkEnd > buffer.byteLength) {
      throw new Error("The GLB file contains an invalid chunk length.");
    }

    if (chunkIndex === 0) {
      if (chunkType !== JSON_CHUNK_TYPE) {
        throw new Error("The GLB file is missing its required JSON chunk.");
      }
      try {
        const jsonText = new TextDecoder()
          .decode(new Uint8Array(buffer, chunkStart, chunkLength))
          .replace(/[\u0000\s]+$/, "");
        jsonDocument = JSON.parse(jsonText) as GlbDocument;
      } catch {
        throw new Error("The GLB file contains invalid model metadata.");
      }
    } else if (chunkType === JSON_CHUNK_TYPE) {
      throw new Error("The GLB file contains an unexpected extra JSON chunk.");
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  if (offset !== buffer.byteLength || !jsonDocument) {
    throw new Error("The GLB file is incomplete.");
  }
  if (jsonDocument.asset?.version !== "2.0") {
    throw new Error("The selected file is not a supported glTF 2.0 model.");
  }

  const externalResources = [
    ...(jsonDocument.buffers ?? []),
    ...(jsonDocument.images ?? []),
  ];
  if (externalResources.some((resource) => typeof resource.uri === "string")) {
    throw new Error(
      "This GLB references external files. Export it as a self-contained GLB with embedded textures and buffers.",
    );
  }

  return jsonDocument;
}
