/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import fetch from "node-fetch";

module.exports.proxy = async (event) => {
  const params = event.queryStringParameters;
  const { Host, host, Origin, origin, ...headers } = event.headers;
  const responseHeaders = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies and authorization headers with HTTPS
  };

  if (!params.username) {
    return {
      statusCode: 400,
      body: "Unable get url from 'url' query parameter",
    };
  }
  const username = params.username as string;

  const url = `https://api.github.com/users/${username}`;
  const res = await fetch(url, {
    method: event.httpMethod,
    timeout: 20000,
    headers: {
      ...headers,
      Authorization: `token ${process.env.GITHUB_API_KEY || ""}`,
      Accept: "application/vnd.github+json",
    },
  });
  console.log(`Got response from ${url} ---> {statusCode: ${res.status}}`);
  const body = await res.text();
  return {
    statusCode: res.status,
    headers: {
      ...responseHeaders,
      "content-type": res.headers["content-type"],
    },
    body,
  };
};
