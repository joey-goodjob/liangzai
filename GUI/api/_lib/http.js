"use strict";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res, allowedMethods) {
  res.setHeader("Allow", allowedMethods.join(", "));
  sendJson(res, 405, {
    error: {
      message: `Method ${allowedMethods.join("/")} required`,
    },
  });
}

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  const rawBody = await readRawBody(req);
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const responseText = await response.text();

  let data = null;
  let parseError = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      parseError = error;
    }
  }

  if (!response.ok) {
    throw createHttpError(
      response.status,
      data?.error?.message || data?.message || `Request failed (${response.status})`,
      responseText.slice(0, 500),
    );
  }

  if (parseError) {
    throw createHttpError(502, "Upstream response was not valid JSON", parseError.message);
  }

  return data;
}

function handleRouteError(res, error) {
  const status = error.status || 500;

  sendJson(res, status, {
    error: {
      message: error.message || "Internal Server Error",
      details: error.details,
    },
  });
}

module.exports = {
  createHttpError,
  fetchJson,
  handleRouteError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
};
