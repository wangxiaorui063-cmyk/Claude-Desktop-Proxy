const http = require("http");
const https = require("https");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");

const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const PROXY_HOST = config.proxy.host;
const PROXY_PORT = config.proxy.port;
const UPSTREAM_BASE = config.upstream.baseUrl;
const MODEL_MAPPING = config.modelMapping;

const upstreamUrl = new URL(UPSTREAM_BASE);
const UPSTREAM_HOSTNAME = upstreamUrl.hostname;
const UPSTREAM_PATH_PREFIX = upstreamUrl.pathname.replace(/\/$/, "");

function translateModel(body) {
  if (body.model && MODEL_MAPPING[body.model]) {
    const original = body.model;
    body.model = MODEL_MAPPING[body.model];
    console.log(`[model] ${original} → ${body.model}`);
  } else if (body.model) {
    console.log(`[model] ${body.model} (无映射，保持原样)`);
  }
  return body;
}

function buildUpstreamPath(pathname, search) {
  return UPSTREAM_PATH_PREFIX + pathname + (search || "");
}

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

const server = http.createServer((clientReq, clientRes) => {
  const { method, headers } = clientReq;
  const parsedUrl = new URL(clientReq.url, `http://${PROXY_HOST}:${PROXY_PORT}`);
  const { pathname, search } = parsedUrl;

  const isMessagesEndpoint =
    method === "POST" && pathname === "/v1/messages";

  if (isMessagesEndpoint) {
    const chunks = [];
    clientReq.on("data", (chunk) => chunks.push(chunk));
    clientReq.on("end", () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch (err) {
        console.error("[error] JSON 解析失败:", err.message);
        sendError(clientRes, 400, "Invalid JSON in request body");
        return;
      }

      translateModel(body);

      const bodyStr = JSON.stringify(body);
      const bodyBuffer = Buffer.from(bodyStr, "utf-8");

      const upstreamHeaders = { ...headers };
      upstreamHeaders["host"] = UPSTREAM_HOSTNAME;
      upstreamHeaders["content-length"] = bodyBuffer.length;

      delete upstreamHeaders["transfer-encoding"];

      const upstreamPath = buildUpstreamPath(pathname, search);

      const options = {
        hostname: UPSTREAM_HOSTNAME,
        port: 443,
        path: upstreamPath,
        method: "POST",
        headers: upstreamHeaders,
      };

      const upstreamReq = https.request(options, (upstreamRes) => {
        clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.pipe(clientRes);
      });

      upstreamReq.on("error", (err) => {
        console.error("[error] 上游请求失败:", err.message);
        if (!clientRes.headersSent) {
          sendError(clientRes, 502, `Upstream request failed: ${err.message}`);
        }
      });

      upstreamReq.write(bodyBuffer);
      upstreamReq.end();
    });

    clientReq.on("error", (err) => {
      console.error("[error] 客户端请求错误:", err.message);
      if (!clientRes.headersSent) {
        sendError(clientRes, 400, "Client request error");
      }
    });

    return;
  }

  const upstreamHeaders = { ...headers };
  upstreamHeaders["host"] = UPSTREAM_HOSTNAME;
  const upstreamPath = buildUpstreamPath(pathname, search);

  const options = {
    hostname: UPSTREAM_HOSTNAME,
    port: 443,
    path: upstreamPath,
    method,
    headers: upstreamHeaders,
  };

  const upstreamReq = https.request(options, (upstreamRes) => {
    clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.pipe(clientRes);
  });

  upstreamReq.on("error", (err) => {
    console.error("[error] 上游请求失败:", err.message);
    if (!clientRes.headersSent) {
      sendError(clientRes, 502, `Upstream request failed: ${err.message}`);
    }
  });

  clientReq.pipe(upstreamReq);

  clientReq.on("error", (err) => {
    console.error("[error] 客户端请求错误:", err.message);
    upstreamReq.destroy();
    if (!clientRes.headersSent) {
      sendError(clientRes, 400, "Client request error");
    }
  });
});

server.listen(PROXY_PORT, PROXY_HOST, () => {
  console.log(`[proxy] Claude → DeepSeek 代理已启动`);
  console.log(`[proxy] 监听地址: http://${PROXY_HOST}:${PROXY_PORT}`);
  console.log(`[proxy] 上游地址: ${UPSTREAM_BASE}`);
  console.log(`[proxy] 模型映射:`, MODEL_MAPPING);
  console.log(`[proxy] 等待请求...`);
});
