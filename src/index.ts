// @ts-ignore Bun loads this asset as text via the import attribute.
import sampleMusicXml from "../examples/but-not-for-me.musicxml" with { type: "text" };
import { runEngine } from "./harmony";
import { parseMusicXml } from "./import";
import { buildProjection } from "./projection";
import { renderNotationSvg } from "./render";

function main(): void {
  const root = document.querySelector("#root");

  if (!(root instanceof HTMLElement)) {
    throw new Error("Missing #root element.");
  }

  const input = parseMusicXml(sampleMusicXml);
  const harmonicStructure = runEngine(input);
  const projection = buildProjection(input, harmonicStructure);
  const app = document.createElement("main");
  const heading = document.createElement("h1");
  const notationView = document.createElement("div");

  app.className = "app";
  heading.textContent = "Notation";
  notationView.className = "notation-view";
  notationView.append(renderNotationSvg(projection));
  app.append(heading, notationView);

  root.replaceChildren();
  root.append(app);
}

main();
