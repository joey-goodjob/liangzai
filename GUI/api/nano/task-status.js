"use strict";

const {
  createHttpError,
  fetchJson,
  handleRouteError,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} = require("../_lib/http");

function parseResultUrl(resultJson) {
  if (!resultJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(resultJson);
    return parsed?.resultUrls?.[0] || null;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = await readJsonBody(req);
    const { apiKey, taskId } = body;

    if (!apiKey) {
      throw createHttpError(400, "apiKey is required");
    }

    if (!taskId) {
      throw createHttpError(400, "taskId is required");
    }

    const url = new URL("https://api.kie.ai/api/v1/jobs/recordInfo");
    url.searchParams.set("taskId", taskId);

    const data = await fetchJson(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (data?.code !== 200 || !data?.data) {
      throw createHttpError(
        502,
        data?.msg || "Nano task status response was invalid",
        JSON.stringify(data).slice(0, 500),
      );
    }

    return sendJson(res, 200, {
      taskId: data.data.taskId,
      state: data.data.state,
      url: parseResultUrl(data.data.resultJson),
      failMsg: data.data.failMsg,
      costTime: data.data.costTime,
    });
  } catch (error) {
    return handleRouteError(res, error);
  }
};
