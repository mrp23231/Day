import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectReleaseEnvironment, renderReleaseReport } from "./check-release.mjs";

const configured = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test_public_key",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-admin-key",
  OPENAI_API_KEY: "server-only-test-openai-key",
  GEMINI_API_KEY: "server-only-test-gemini-key",
};

test("missing integrations block the configured beta without blocking local mode", () => {
  const report = inspectReleaseEnvironment({}, "20.20.1");
  assert.equal(report.ready, false);
  assert.deepEqual(report.checks.filter((check) => !check.ok).map((check) => check.id), ["supabase-url", "supabase-public-key", "supabase-admin-key", "openai-key", "food-ai-key"]);
});

test("food recognition checks the explicitly selected provider without a paid fallback", () => {
  assert.equal(inspectReleaseEnvironment({...configured,GEMINI_API_KEY:""}).checks.find(check=>check.id==="food-ai-key")?.ok,false);
  assert.equal(inspectReleaseEnvironment({...configured,GEMINI_API_KEY:"",FOOD_AI_PROVIDER:"openai"}).ready,true);
  assert.equal(inspectReleaseEnvironment({...configured,FOOD_AI_PROVIDER:"unknown"}).ready,false);
});

test("all required settings and a supported Node version satisfy the configuration check", () => {
  assert.equal(inspectReleaseEnvironment(configured, "20.20.1").ready, true);
  assert.equal(inspectReleaseEnvironment(configured, "22.0.0").ready, true);
});

test("unsupported Node versions cannot pass even when secrets are configured", () => {
  for (const version of ["18.20.0", "20.8.9", "invalid"]) {
    const report = inspectReleaseEnvironment(configured, version);
    assert.equal(report.ready, false);
    assert.equal(report.checks.find((check) => check.id === "node").ok, false);
  }
});

test("Supabase must use HTTPS with no embedded credentials for the published beta", () => {
  for (const url of ["not a URL", "http://example.supabase.co", "https://name:password@example.supabase.co", "https://example.supabase.co?token=secret", "https://example.supabase.co#secret"]) {
    assert.equal(inspectReleaseEnvironment({ ...configured, NEXT_PUBLIC_SUPABASE_URL: url }, "20.20.1").ready, false);
  }
});

test("a secret Supabase key must never be accepted in the browser environment", () => {
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  for (const key of ["sb_secret_server-only", `header.${payload}.signature`]) {
    const report = inspectReleaseEnvironment({ ...configured, NEXT_PUBLIC_SUPABASE_ANON_KEY: key }, "20.20.1");
    assert.equal(report.ready, false);
    assert.equal(report.checks.find((check) => check.id === "supabase-public-key").ok, false);
  }
});

test("output contains statuses and variable names, never configured values", () => {
  const report = inspectReleaseEnvironment(configured, "20.20.1");
  const output = renderReleaseReport(report);
  for (const value of Object.values(configured)) assert.equal(output.includes(value), false);
  assert.match(output, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(output, /live/i);
});

test("whitespace values are missing, while the optional model does not block release", () => {
  assert.equal(inspectReleaseEnvironment({ ...configured, OPENAI_API_KEY: "   " }, "20.20.1").ready, false);
  assert.equal(inspectReleaseEnvironment({ ...configured, OPENAI_MODEL: "" }, "20.20.1").ready, true);
});


function withEnvironmentFiles(files, run) {
  const directory = mkdtempSync(path.join(tmpdir(), "day-release-preflight-"));
  try {
    for (const [name, contents] of Object.entries(files)) writeFileSync(path.join(directory, name), contents);
    const env = { ...process.env, NODE_ENV: "test" };
    for (const name of Object.keys(configured)) delete env[name];
    delete env.OPENAI_MODEL;
    delete env.FOOD_AI_PROVIDER;
    delete env.GEMINI_FOOD_MODEL;
    delete env.__NEXT_PROCESSED_ENV;
    return run((args = []) => spawnSync(process.execPath, [fileURLToPath(new URL("./check-release.mjs", import.meta.url)), ...args], { cwd: directory, env, encoding: "utf8" }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("CLI loads production files with Next precedence without exposing their values", () => {
  withEnvironmentFiles({
    ".env.local": "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\n",
    ".env.production": `NEXT_PUBLIC_SUPABASE_URL=invalid\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${configured.NEXT_PUBLIC_SUPABASE_ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${configured.SUPABASE_SERVICE_ROLE_KEY}\nOPENAI_API_KEY=${configured.OPENAI_API_KEY}\nGEMINI_API_KEY=${configured.GEMINI_API_KEY}\n`,
    ".env.development": "OPENAI_API_KEY=\n",
  }, (run) => {
    const result = run(["--strict"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    for (const value of Object.values(configured)) assert.equal(result.stdout.includes(value), false);
    assert.equal(result.stderr, "");
  });
});

test("CLI exits informatively for local mode and refuses an unconfigured strict release", () => {
  withEnvironmentFiles({}, (run) => {
    assert.equal(run().status, 0);
    assert.equal(run(["--strict"]).status, 1);
    assert.equal(run(["--unknown"]).status, 2);
    assert.equal(run(["--help"]).status, 0);
  });
});
