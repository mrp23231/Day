import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const requiredVariables = [
  ["supabase-url", "NEXT_PUBLIC_SUPABASE_URL"],
  ["supabase-public-key", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  ["supabase-admin-key", "SUPABASE_SERVICE_ROLE_KEY"],
  ["openai-key", "OPENAI_API_KEY"],
];

function safePublicKey(value) {
  if (value.startsWith("sb_secret_")) return false;
  const segments = value.split(".");
  if (segments.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
      if (payload.role && payload.role !== "anon") return false;
    } catch {
      // A configured value is not proof of a valid credential. Live checks remain required.
    }
  }
  return true;
}

export function inspectReleaseEnvironment(env, nodeVersion = process.versions.node) {
  const [major, minor] = nodeVersion.split(".").map(Number);
  const checks = [{
    id: "node",
    label: "Node.js ≥ 20.9",
    ok: Number.isInteger(major) && Number.isInteger(minor) && (major > 20 || (major === 20 && minor >= 9)),
    detail: "Проверяется минимальная версия Next.js; для хостинга выберите поддерживаемую LTS-версию.",
  }];
  for (const [id, label] of requiredVariables) {
    const value = String(env[label] || "").trim();
    let ok = Boolean(value);
    let detail = ok ? "Задано; работоспособность сервиса проверяется отдельно." : "Не задано.";
    if (id === "supabase-url" && value) {
      try {
        const url = new URL(value);
        ok = url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash;
      } catch { ok = false; }
      if (!ok) detail = "Нужен HTTPS URL проекта без учётных данных, query и fragment.";
    }
    if (id === "supabase-public-key" && value && !safePublicKey(value)) {
      ok = false;
      detail = "В публичной переменной обнаружен серверный ключ. Удалите его, отзовите утёкший ключ и пересоберите приложение.";
    }
    checks.push({ id, label, ok, detail });
  }
  return { checks, ready: checks.every((check) => check.ok) };
}

export function renderReleaseReport(report) {
  return [
    "Day — проверка конфигурации production",
    ...report.checks.map((check) => `${check.ok ? "OK" : "НУЖНО"} · ${check.label}: ${check.detail}`),
    "OPENAI_MODEL необязателен; без значения используется модель по умолчанию приложения.",
    report.ready ? "Конфигурация задана. Это не подтверждает готовность к публикации." : "Облачная бета пока не настроена; локальный режим остаётся доступен.",
    "Live-проверки входа, писем, двух аккаунтов/RLS, удаления и AI обязательны: docs/release.md.",
  ].join("\n");
}

function run() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: npm run release:check -- [--strict]\nПроверяет production .env-файлы без вывода значений и без сетевых запросов.\n--strict: код 1, если обязательная конфигурация облачной беты отсутствует или некорректна.");
    return;
  }
  if (args.some((arg) => arg !== "--strict")) {
    console.error("Неизвестный аргумент. Используйте --help.");
    process.exitCode = 2;
    return;
  }
  try {
    // Resolve the env loader belonging to the installed Next version, not a separately hoisted package.
    const require = createRequire(import.meta.url);
    const requireNext = createRequire(require.resolve("next/package.json"));
    const { loadEnvConfig } = requireNext("@next/env");
    process.env.NODE_ENV = "production";
    let loadError = false;
    loadEnvConfig(process.cwd(), false, { info() {}, error() { loadError = true; } });
    if (loadError) throw new Error("Environment file loading failed");
    const report = inspectReleaseEnvironment(process.env);
    console.log(renderReleaseReport(report));
    if (args.includes("--strict") && !report.ready) process.exitCode = 1;
  } catch {
    console.error("Не удалось прочитать production-конфигурацию. Проверьте npm ci и синтаксис .env-файлов; значения не выводятся.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
