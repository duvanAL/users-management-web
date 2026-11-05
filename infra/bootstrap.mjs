import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const require = createRequire("/app/package.json");
const { Pool } = require("pg");
const { Kafka, logLevel } = require("kafkajs");
const {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketVersioningCommand,
} = require("@aws-sdk/client-s3");
async function retry(work) {
  for (let n = 0; n < 60; n++) {
    try {
      return await work();
    } catch (error) {
      if (n === 59) throw error;
      await delay(2000);
    }
  }
}
const kafka = new Kafka({
  brokers: ["kafka:9092"],
  logLevel: logLevel.NOTHING,
});
const admin = kafka.admin();
await retry(() => admin.connect());
await admin.createTopics({
  topics: [
    "user.notification.requested",
    "user.notification.result",
    "user.notification.dlq",
    "file.storage.dlq",
    "search.projection.dlq",
  ].map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
});
await admin.disconnect();
const s3 = new S3Client({
  endpoint: "http://s3:9090",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "dev-only", secretAccessKey: "dev-only-key" },
});
await retry(async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: "users-files-dev" }));
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 404) throw error;
    await s3.send(new CreateBucketCommand({ Bucket: "users-files-dev" }));
  }
});
await s3.send(
  new PutBucketVersioningCommand({
    Bucket: "users-files-dev",
    VersioningConfiguration: { Status: "Enabled" },
  }),
);
s3.destroy();
const index = "users-accounts-search-v1";
const os = async (method, path, body) => {
  const result = await fetch("http://opensearch:9200/" + index + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!result.ok) throw new Error("Local index setup failed");
  return result.json();
};
const properties = {
  id: { type: "keyword" },
  kind: { type: "keyword" },
  userId: { type: "keyword" },
  revision: { type: "keyword" },
  eventId: { type: "keyword" },
  deleted: { type: "boolean" },
  occurredOn: { type: "date" },
  name: { type: "text" },
  email: { type: "keyword" },
  role: { type: "keyword" },
  status: { type: "keyword" },
  accountType: { type: "keyword" },
};
const existing = await fetch("http://opensearch:9200/" + index);
if (existing.status === 404)
  await os("PUT", "", {
    settings: { number_of_shards: 1, number_of_replicas: 0 },
    mappings: { dynamic: "strict", properties },
  });
const pool = new Pool({
  connectionString:
    "postgresql://postgres:dev-database-only@postgres:5432/management_dev",
});
for (const name of ["users", "accounts"]) {
  const results = await pool.query(
    await readFile("/snapshots/" + name + "-snapshot.sql", "utf8"),
  );
  for (const row of results.flatMap((result) => result.rows ?? [])) {
    const e = row.json_build_object,
      p = e.payload;
    const doc = {
      id: name === "users" ? p.userId : p.accountId,
      kind: name === "users" ? "user" : "account",
      userId: p.userId,
      revision: p.projectionVersion,
      eventId: e.eventId,
      deleted: e.eventName === "user.deleted",
      occurredOn: e.occurredOn,
    };
    if (!doc.deleted) {
      if (name === "users")
        Object.assign(doc, {
          name: p.name,
          email: p.email,
          role: p.role,
          status: p.status,
        });
      else doc.accountType = p.accountType;
    }
    await os(
      "POST",
      "/_update/" +
        encodeURIComponent(doc.kind + ":" + doc.id) +
        "?retry_on_conflict=10",
      {
        scripted_upsert: true,
        upsert: {},
        script: {
          lang: "painless",
          source:
            "if (ctx.op == 'create' || Long.parseLong(params.doc.revision) > Long.parseLong(ctx._source.revision)) { ctx._source = params.doc; } else { ctx.op = 'none'; }",
          params: { doc },
        },
      },
    );
  }
}
await os("POST", "/_refresh");
await pool.end();
console.info("Local topics, versioned bucket and search snapshots are ready.");
