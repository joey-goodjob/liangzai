"use strict";

const { put } = require("@vercel/blob");
const { Buffer } = require("node:buffer");
const crypto = require("node:crypto");
const path = require("node:path");
const {
  createHttpError,
  handleRouteError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} = require("./_lib/http");

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!match) {
    throw createHttpError(400, "Invalid dataUrl payload");
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function sanitizeFilename(filename, contentType) {
  const baseName = path.basename(filename || "upload")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (baseName.includes(".")) {
    return baseName;
  }

  const extension = contentType.split("/")[1] || "bin";
  return `${baseName || "upload"}.${extension}`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw createHttpError(
        500,
        "Missing BLOB_READ_WRITE_TOKEN environment variable",
      );
    }

    const body = await readJsonBody(req);
    const { dataUrl, filename } = body;

    if (!dataUrl) {
      throw createHttpError(400, "dataUrl is required");
    }

    const { contentType, buffer } = parseDataUrl(dataUrl);
    const safeName = sanitizeFilename(filename, contentType);
    const pathname = `nano-uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
    const blob = await put(pathname, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return sendJson(res, 200, {
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    return handleRouteError(res, error);
  }
};
