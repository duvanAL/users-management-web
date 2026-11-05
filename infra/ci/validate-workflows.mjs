import { readFileSync, readdirSync } from "node:fs";
import { parseDocument } from "yaml";
for (const file of readdirSync(".github/workflows").filter((f) =>
  f.endsWith(".yml"),
)) {
  const doc = parseDocument(readFileSync(".github/workflows/" + file, "utf8"));
  if (doc.errors.length) throw new Error(file + ": " + doc.errors.join("; "));
  const workflow = doc.toJS();
  if (!workflow.name || !workflow.on || !workflow.jobs)
    throw new Error(file + ": missing workflow fields");
  if ("pull_request_target" in workflow.on)
    throw new Error(file + ": privileged PR trigger is forbidden");
  if (workflow.permissions?.contents !== "read")
    throw new Error(file + ": default token must be read-only");
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (!job["timeout-minutes"])
      throw new Error(file + "/" + name + ": missing timeout");
    for (const step of job.steps || [])
      if (step.uses && !/^.+@[a-f0-9]{40}$/.test(step.uses))
        throw new Error(file + ": action must be pinned by full commit SHA");
  }
  console.log(file + ": valid");
}
