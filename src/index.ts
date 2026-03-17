import { runEngine } from "./engine";
import { buildProjection } from "./projection";
import { renderApp } from "./render";
import { SEED_INPUT } from "./seed-input";

function main(): void {
  const root = document.querySelector("#root");

  if (!(root instanceof HTMLElement)) {
    throw new Error("Missing #root element.");
  }

  const harmonicStructure = runEngine(SEED_INPUT);
  const projection = buildProjection(SEED_INPUT, harmonicStructure);
  const app = renderApp(projection);

  root.replaceChildren();
  root.append(app);
}

main();
