import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
let mode = "success";
createServer(async (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200);
    response.end("OK");
    return;
  }
  if (request.url === "/mode" && request.method === "POST") {
    let body = "";
    for await (const part of request) {
      body += part;
      if (body.length > 1000) {
        response.writeHead(413);
        response.end();
        return;
      }
    }
    mode = body === "fail" ? "fail" : "success";
    response.writeHead(200);
    response.end(mode);
    return;
  }
  if (request.url === "/v3/smtp/email" && request.method === "POST") {
    for await (const _part of request) {
      /* Local provider accepts and discards artificial messages. */
    }
    response.writeHead(mode === "fail" ? 503 : 201, {
      "content-type": "application/json",
    });
    response.end(
      JSON.stringify(
        mode === "fail"
          ? { code: "DEV_PROVIDER_UNAVAILABLE" }
          : { messageId: randomUUID() },
      ),
    );
    return;
  }
  response.writeHead(404);
  response.end();
}).listen(8086, "0.0.0.0");
