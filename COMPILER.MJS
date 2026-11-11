/**
 * Forge Launcher — COMPILER.MJS · the build orchestrator.
 * Runs the RS pipeline over the mirrored Cinnabar acceptance tree
 * (library/.bedrock/res) and lays down the workspace:
 *
 *   src/       compiled JS module stubs (one per .rs file) + index.js
 *   ts/        TypeScript declarations + index.d.ts
 *   database/  db.json — the artifact index (IR of every compiled module)
 *   fs/        vfs.json — the workspace manifest the VM can walk
 *   bedrock/   compiled.json — bedrock-side compile summary
 *
 * Run it directly:  runtime\bun.exe COMPILER.MJS
 * Or through the server: POST /api/rscompile
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileRustSource, emitJs, emitTs } from "./RsCOMPILERcore.ts";

const ROOT =
  process.env.FORGE_HOME ||
  (existsSync(join(process.cwd(), "VERSION.json"))
    ? process.cwd() // launcher home (dev run & the compiled exe both set cwd)
    : dirname(fileURLToPath(import.meta.path)));
const LIB = join(ROOT, "library");
const RES_MANIFEST = join(LIB, ".bedrock", "res.json");

/** Compile the whole mirrored res tree into the workspace. */
export async function runCompile() {
  if (!existsSync(RES_MANIFEST)) {
    throw new Error("no bedrock res manifest — run the res sync first (POST /api/bedrock/res)");
  }
  const manifest = JSON.parse(readFileSync(RES_MANIFEST, "utf8"));
  if (!manifest.files?.length) throw new Error("the res manifest is empty — run the res sync first");

  for (const dir of ["src", "ts", "database", "fs", join("bedrock")]) {
    mkdirSync(join(ROOT, dir), { recursive: true });
  }

  const modules = [];
  for (const f of manifest.files) {
    const srcPath = join(LIB, ".bedrock", "res", f.path.replace(/^.*\//, ""));
    if (!existsSync(srcPath)) continue;
    const source = readFileSync(srcPath, "utf8");
    const ir = compileRustSource(source, f.path.replace(/^.*\//, ""));
    const js = emitJs(ir);
    const ts = emitTs(ir);
    const outJs = join(ROOT, "src", `${ir.module}.js`);
    const outTs = join(ROOT, "ts", `${ir.module}.d.ts`);
    writeFileSync(outJs, js);
    writeFileSync(outTs, ts);
    modules.push({
      file: ir.file,
      module: ir.module,
      fns: ir.fns.length,
      structs: ir.structs.length,
      enums: ir.enums.length,
      uses: ir.uses.length,
      loc: ir.loc,
      out: { js: "src/" + `${ir.module}.js`, ts: "ts/" + `${ir.module}.d.ts` },
      ir,
    });
  }

  if (!modules.length) throw new Error("nothing compiled — the res tree is missing on disk");

  // src/index.js — re-export barrel
  writeFileSync(
    join(ROOT, "src", "index.js"),
    `/** compiled by COMPILER.MJS — ${modules.length} module(s) */\n` +
      modules.map((m) => `export * from "./${m.module}.js";`).join("\n") +
      "\n",
  );
  writeFileSync(
    join(ROOT, "ts", "index.d.ts"),
    `// compiled by COMPILER.MJS — ${modules.length} module(s)\n` +
      modules.map((m) => `export * from "./${m.module}";`).join("\n") +
      "\n",
  );

  // database/db.json — the artifact index
  const db = {
    compiledAt: new Date().toISOString(),
    source: manifest.link ?? "library/.bedrock/res",
    modules: modules.map(({ ir, ...m }) => ({ ...m, ir })),
  };
  writeFileSync(join(ROOT, "database", "db.json"), JSON.stringify(db, null, 2) + "\n");

  // fs/vfs.json — the workspace manifest
  const vfs = {
    generatedAt: db.compiledAt,
    roots: {
      "src/": modules.map((m) => m.out.js).concat("src/index.js"),
      "ts/": modules.map((m) => m.out.ts).concat("ts/index.d.ts"),
      "database/": ["database/db.json"],
      "bedrock/": ["bedrock/compiled.json"],
    },
  };
  writeFileSync(join(ROOT, "fs", "vfs.json"), JSON.stringify(vfs, null, 2) + "\n");

  // bedrock/compiled.json — bedrock-side summary
  writeFileSync(
    join(ROOT, "bedrock", "compiled.json"),
    JSON.stringify(
      {
        compiledAt: db.compiledAt,
        repo: manifest.repo,
        resPath: manifest.resPath,
        modules: modules.length,
        fns: modules.reduce((n, m) => n + m.fns, 0),
        structs: modules.reduce((n, m) => n + m.structs, 0),
        enums: modules.reduce((n, m) => n + m.enums, 0),
        loc: modules.reduce((n, m) => n + m.loc, 0),
      },
      null,
      2,
    ) + "\n",
  );

  return {
    ok: true,
    modules: modules.length,
    fns: modules.reduce((n, m) => n + m.fns, 0),
    structs: modules.reduce((n, m) => n + m.structs, 0),
    enums: modules.reduce((n, m) => n + m.enums, 0),
    loc: modules.reduce((n, m) => n + m.loc, 0),
    files: modules.map((m) => ({ module: m.module, js: m.out.js, ts: m.out.ts, fns: m.fns, ir: m.ir })),
  };
}

/* CLI: bun COMPILER.MJS */
const isMain = process.argv[1] && /COMPILER\.MJS$/i.test(process.argv[1]);
if (isMain) {
  runCompile()
    .then((r) => {
      console.log(`✔ compiled ${r.modules} module(s) — ${r.fns} fn(s), ${r.structs} struct(s), ${r.enums} enum(s), ${r.loc} loc`);
      for (const f of r.files) console.log(`  · ${f.module} → ${f.js} (+${f.ts})`);
    })
    .catch((e) => {
      console.error(`✘ ${e.message}`);
      process.exit(1);
    });
}
