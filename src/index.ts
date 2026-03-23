// @ts-ignore Bun loads this asset as text via the import attribute.
import sampleMusicXml from "../examples/mozart-sonata-16-allegro.musicxml" with { type: "text" };
import { runEngine } from "./engine";
import { parseMusicXml } from "./import";
import { buildProjection } from "./projection";
import { renderApp } from "./render";
import { SEED_INPUT } from "./seed-input";

function loadPieceInput() {
  try {
    return parseMusicXml(sampleMusicXml);
  } catch (error) {
    console.warn("Falling back to seed input.", error);
    return SEED_INPUT;
  }
}

function main(): void {
  const root = document.querySelector("#root");

  if (!(root instanceof HTMLElement)) {
    throw new Error("Missing #root element.");
  }

  const input = loadPieceInput();
  const harmonicStructure = runEngine(input);
  const projection = buildProjection(input, harmonicStructure);
  const app = renderApp(projection);

  root.replaceChildren();
  root.append(app);
}

main();
