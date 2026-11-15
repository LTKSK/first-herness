import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";

const [manifestArg, outputArg] = process.argv.slice(2);
if (!manifestArg || !outputArg)
  throw new Error("Usage: node viewer/prepare.mjs <manifest.json> <report.json>");
const manifestPath = resolve(manifestArg),
  output = resolve(outputArg);
const source = JSON.parse(await readFile(manifestPath, "utf8"));
const allowed = new Set(["pass", "fail", "unknown", "not_run", "patch_error", "environment_error"]);
const requireText = (value, name) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
};
const array = (v, name) => {
  if (!Array.isArray(v)) throw new Error(`${name} must be an array`);
  return v;
};
if (source.formatVersion !== 1) throw new Error("Unsupported manifest format");
for (const name of ["title", "summary", "baseline", "candidate"]) requireText(source[name], name);
const versions = array(source.candidateVersions, "candidateVersions");
for (const version of versions) requireText(version, "candidate version");
if (new Set(versions).size !== versions.length || !versions.includes(source.candidate))
  throw new Error("candidateVersions must uniquely include the final candidate");
const base = dirname(manifestPath);
const load = async (files, type) =>
  Promise.all(
    array(files, type).map(async (file) => {
      requireText(file, `${type} path`);
      const record = JSON.parse(await readFile(resolve(base, file), "utf8"));
      if (
        record.formatVersion !== 1 ||
        record.recordType !== type ||
        !versions.includes(record.targetId)
      )
        throw new Error(`Invalid ${type} record or candidate: ${file}`);
      requireText(record.id, `${type} id`);
      requireText(record.summary, `${type} summary`);
      if (type === "evaluation") {
        requireText(record.type, "evaluation type");
        if (!allowed.has(record.result)) throw new Error(`Invalid evaluation result: ${file}`);
        array(record.findings, "findings");
        for (const f of record.findings) {
          requireText(f.id, "finding id");
          requireText(f.summary, "finding summary");
          requireText(f.evidence, "finding evidence");
        }
      }
      return record;
    }),
  );
const evaluations = await load(source.evaluationFiles, "evaluation"),
  revisions = await load(source.revisionFiles, "revision");
const ids = (records, label) => {
  const values = records.map((r) => r.id);
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} id`);
  return new Set(values);
};
const evalIds = ids(evaluations, "evaluation"),
  findingIds = ids(
    evaluations.flatMap((e) => e.findings),
    "finding",
  );
ids(revisions, "revision");
for (const revision of revisions) {
  requireText(revision.fromTargetId, "revision fromTargetId");
  if (!versions.includes(revision.fromTargetId))
    throw new Error(`Unknown original candidate: ${revision.fromTargetId}`);
  array(revision.findingIds, "findingIds");
  for (const id of revision.findingIds)
    if (!findingIds.has(id)) throw new Error(`Unknown finding: ${id}`);
    else if (
      !evaluations.some(
        (e) => e.targetId === revision.fromTargetId && e.findings.some((f) => f.id === id),
      )
    )
      throw new Error(`Finding candidate mismatch: ${id}`);
  if (revision.reevaluationId && !evalIds.has(revision.reevaluationId))
    throw new Error(`Unknown reevaluation: ${revision.reevaluationId}`);
  if (
    revision.reevaluationId &&
    evaluations.find((e) => e.id === revision.reevaluationId).targetId !== revision.targetId
  )
    throw new Error(`Reevaluation candidate mismatch: ${revision.reevaluationId}`);
}
const requirements = array(source.requirements, "requirements");
ids(requirements, "requirement");
for (const req of requirements) {
  requireText(req.id, "requirement id");
  requireText(req.description, "requirement description");
  if (!allowed.has(req.result)) throw new Error(`Invalid requirement result: ${req.id}`);
  array(req.checks, "checks");
  for (const check of req.checks) {
    requireText(check.description, "check description");
    requireText(check.evidence, "check evidence");
    if (!allowed.has(check.result)) throw new Error(`Invalid check result: ${req.id}`);
  }
  if (req.result === "pass" && (!req.checks.length || req.checks.some((c) => c.result !== "pass")))
    throw new Error(`Unverified requirement cannot pass: ${req.id}`);
}
const videos = array(source.videos, "videos");
if (videos.length !== 1 || !["annotated", "comparison"].includes(videos[0].kind))
  throw new Error(
    "Exactly one annotated or comparison video is required, with a reason if missing",
  );
for (const v of videos) {
  requireText(v.title, "video title");
  if (v.kind === "comparison" && v.baselineId !== source.baseline)
    throw new Error("Comparison baseline mismatch");
  if (v.path) {
    if (v.targetId !== source.candidate) throw new Error(`Video candidate mismatch: ${v.title}`);
    v.path = relative(dirname(output), resolve(base, v.path));
  } else requireText(v.reason, `missing video reason: ${v.title}`);
}
const report = {
  formatVersion: 1,
  title: source.title,
  summary: source.summary,
  baseline: source.baseline,
  candidate: source.candidate,
  videos,
  requirements,
  evaluations: evaluations.map((e) => ({ ...e, title: e.title || e.type })),
  revisions,
};
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
