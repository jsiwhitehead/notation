import glyphNames from "./glyphnames.json";
import lelandMetadata from "./leland_metadata.json";

const MUSIC_FONT_FAMILY = "Leland";

type GlyphNamesData = typeof glyphNames;
export type GlyphName = keyof GlyphNamesData;

type Point = {
  x: number;
  y: number;
};

type BoundingBox = {
  ne: Point;
  sw: Point;
};

type EngravingDefaults = typeof lelandMetadata.engravingDefaults;

type MetadataBoundingBox = {
  bBoxNE: number[];
  bBoxSW: number[];
};

type MetadataAnchorMap = Partial<Record<string, number[]>>;

const METADATA_GLYPH_BOUNDS = lelandMetadata.glyphBBoxes as Partial<
  Record<GlyphName, MetadataBoundingBox>
>;
const METADATA_GLYPH_ANCHORS = lelandMetadata.glyphsWithAnchors as Partial<
  Record<GlyphName, MetadataAnchorMap>
>;
const GLYPH_CHARACTERS = Object.fromEntries(
  Object.entries(glyphNames).map(([name, value]) => [
    name,
    String.fromCodePoint(Number.parseInt(value.codepoint.slice(2), 16)),
  ]),
) as Record<GlyphName, string>;

function getRequiredGlyphBounds(name: GlyphName): MetadataBoundingBox {
  const bounds = METADATA_GLYPH_BOUNDS[name];

  if (bounds === undefined) {
    throw new Error(`Missing SMuFL bounds for glyph: ${name}`);
  }

  return bounds;
}

function getRequiredPoint(values: number[], label: string): Point {
  const [x, y] = values;

  if (x === undefined || y === undefined) {
    throw new Error(`Missing SMuFL point for ${label}`);
  }

  return { x, y };
}

export function getMusicFontFamily(): string {
  return MUSIC_FONT_FAMILY;
}

export function getGlyphCharacter(name: GlyphName): string {
  const glyphCharacter = GLYPH_CHARACTERS[name];

  if (glyphCharacter === undefined) {
    throw new Error(`Missing SMuFL glyph mapping for: ${name}`);
  }

  return glyphCharacter;
}

export function getGlyphBox(name: GlyphName): BoundingBox {
  const bounds = getRequiredGlyphBounds(name);

  return {
    ne: getRequiredPoint(bounds.bBoxNE, `${name}.bBoxNE`),
    sw: getRequiredPoint(bounds.bBoxSW, `${name}.bBoxSW`),
  };
}

export function getAnchor(
  name: GlyphName,
  anchorName: string,
): Point | undefined {
  const anchor = METADATA_GLYPH_ANCHORS[name]?.[anchorName];

  return anchor === undefined
    ? undefined
    : getRequiredPoint(anchor, `${name}.${anchorName}`);
}

export function getEngravingDefaults(): EngravingDefaults {
  return lelandMetadata.engravingDefaults;
}
