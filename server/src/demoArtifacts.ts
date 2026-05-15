import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const demoLandingPageRelativePath = "demo-output/voice-recipe-landing-page.html";

const demoLandingPageHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Voice Recipe</title>
    <style>
      body {
        margin: 0;
        background: #10131a;
        color: #f8fafc;
        font-family: Inter, system-ui, sans-serif;
      }

      main {
        min-height: 100vh;
        padding: 56px;
      }

      .hero {
        max-width: 960px;
        padding: 72px 0 48px;
      }

      h1 {
        max-width: 760px;
        margin: 0;
        font-size: 64px;
        line-height: 1;
      }

      p {
        max-width: 660px;
        color: #b9c6d6;
        font-size: 20px;
        line-height: 1.5;
      }

      .pricing {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        max-width: 960px;
      }

      .plan {
        border: 1px solid #2e3948;
        border-radius: 8px;
        background: #171d26;
        padding: 24px;
      }

      .price {
        color: #62d6c8;
        font-size: 32px;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>Voice Recipe</h1>
        <p>Plan dinner hands-free with spoken recipe search, step-by-step cooking prompts, and a calm dark kitchen display.</p>
      </section>
      <section class="pricing" aria-label="Pricing">
        <article class="plan"><h2>Starter</h2><p class="price">$9</p><p>Voice recipes and pantry-aware suggestions.</p></article>
        <article class="plan"><h2>Family</h2><p class="price">$19</p><p>Shared meal plans, timers, and weekly menus.</p></article>
        <article class="plan"><h2>Chef</h2><p class="price">$39</p><p>Advanced substitutions, nutrition notes, and exportable menus.</p></article>
      </section>
    </main>
  </body>
</html>
`;

const resolveInsideRepo = (repoRoot: string, relativePath: string): string => {
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Demo artifact path must stay inside the repo root.");
  }
  return target;
};

export const writeDemoLandingPageArtifact = async (
  repoRoot: string
): Promise<{ relativePath: string; message: string }> => {
  const targetPath = resolveInsideRepo(repoRoot, demoLandingPageRelativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, demoLandingPageHtml, "utf8");
  return {
    relativePath: demoLandingPageRelativePath,
    message: `Wrote ${demoLandingPageRelativePath} for the mock demo.`
  };
};
