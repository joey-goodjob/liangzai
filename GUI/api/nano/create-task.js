"use strict";

const {
  createHttpError,
  fetchJson,
  handleRouteError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} = require("../_lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = await readJsonBody(req);
    const { apiKey, prompt, imageUrls = [], resolution } = body;

    if (!apiKey) {
      throw createHttpError(400, "apiKey is required");
    }

    if (!prompt) {
      throw createHttpError(400, "prompt is required");
    }

    if (!resolution) {
      throw createHttpError(400, "resolution is required");
    }

    const input = {
      prompt,
      aspect_ratio: "auto",
      resolution,
      output_format: "jpg",
    };

    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      input.image_input = imageUrls;
    }

    const payload = {
      model: "nano-banana-2",
      input,
    };

    const data = await fetchJson("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (data?.code !== 200 || !data?.data?.taskId) {
      throw createHttpError(
        502,
        data?.msg || "Nano createTask did not return a taskId",
        JSON.stringify(data).slice(0, 500),
      );
    }

    return sendJson(res, 200, {
      taskId: data.data.taskId,
    });
  } catch (error) {
    return handleRouteError(res, error);
  }
};
