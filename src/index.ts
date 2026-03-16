import { runEngine } from "./engine";
import { buildPlacement } from "./placement";
import { renderApp } from "./render";
import { SEED_INPUT } from "./seed-input";

function main(): void {
  const root = document.querySelector("#root");

  if (!(root instanceof HTMLElement)) {
    throw new Error("Missing #root element.");
  }

  const harmonicStructure = runEngine(SEED_INPUT);
  const placement = buildPlacement(SEED_INPUT, harmonicStructure);
  const app = renderApp(placement);

  root.replaceChildren();
  root.append(app);
}

main();
