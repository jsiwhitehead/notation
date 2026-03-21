import glyphNames from "./glyphnames.json";
import lelandMetadata from "./leland_metadata.json";

const MUSIC_FONT_FAMILY = "Leland";

type GlyphNamesData = typeof glyphNames;
export type SmuflGlyphName = keyof GlyphNamesData;
export type SmuflAnchorName = string;

export type SmuflPoint = {
  x: number;
  y: number;
};

export type SmuflBoundingBox = {
  ne: SmuflPoint;
  sw: SmuflPoint;
};

export type SmuflEngravingDefaults = typeof lelandMetadata.engravingDefaults;

type MetadataBoundingBox = {
  bBoxNE: number[];
  bBoxSW: number[];
};

type MetadataAnchorMap = Partial<Record<string, number[]>>;

const METADATA_GLYPH_BOUNDS = lelandMetadata.glyphBBoxes as Partial<
  Record<SmuflGlyphName, MetadataBoundingBox>
>;
const METADATA_GLYPH_ANCHORS = lelandMetadata.glyphsWithAnchors as Partial<
  Record<SmuflGlyphName, MetadataAnchorMap>
>;
const GLYPH_CHARACTERS = Object.fromEntries(
  Object.entries(glyphNames).map(([name, value]) => [
    name,
    String.fromCodePoint(Number.parseInt(value.codepoint.slice(2), 16)),
  ]),
) as Record<SmuflGlyphName, string>;

function getRequiredGlyphBounds(name: SmuflGlyphName): MetadataBoundingBox {
  const bounds = METADATA_GLYPH_BOUNDS[name];

  if (bounds === undefined) {
    throw new Error(`Missing SMuFL bounds for glyph: ${name}`);
  }

  return bounds;
}

function getRequiredPoint(values: number[], label: string): SmuflPoint {
  const [x, y] = values;

  if (x === undefined || y === undefined) {
    throw new Error(`Missing SMuFL point for ${label}`);
  }

  return { x, y };
}

export function getMusicFontFamily(): string {
  return MUSIC_FONT_FAMILY;
}

export function getSmuflGlyphCharacter(name: SmuflGlyphName): string {
  const glyphCharacter = GLYPH_CHARACTERS[name];

  if (glyphCharacter === undefined) {
    throw new Error(`Missing SMuFL glyph mapping for: ${name}`);
  }

  return glyphCharacter;
}

export function getSmuflGlyphBox(name: SmuflGlyphName): SmuflBoundingBox {
  const bounds = getRequiredGlyphBounds(name);

  return {
    ne: getRequiredPoint(bounds.bBoxNE, `${name}.bBoxNE`),
    sw: getRequiredPoint(bounds.bBoxSW, `${name}.bBoxSW`),
  };
}

export function getSmuflAnchor(
  name: SmuflGlyphName,
  anchorName: SmuflAnchorName,
): SmuflPoint | undefined {
  const anchor = METADATA_GLYPH_ANCHORS[name]?.[anchorName];

  return anchor === undefined
    ? undefined
    : getRequiredPoint(anchor, `${name}.${anchorName}`);
}

export function getEngravingDefaults(): SmuflEngravingDefaults {
  return lelandMetadata.engravingDefaults;
}
