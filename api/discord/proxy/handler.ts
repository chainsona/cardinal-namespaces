/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

module.exports.proxy = (event) => {
  const params = event.queryStringParameters;
  const { Host, host, Origin, origin, ...headers } = event.headers;
  const responseHeaders = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };

  if (!params.url) {
    return {
      statusCode: 400,
      body: "Unable get url from 'url' query parameter",
    };
  }

  if (!params.initial) {
    return {
      statusCode: 400,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      body: JSON.stringify({ error: "No initial provided" }),
    };
  }
  return {
    statusCode: 200,
    headers: responseHeaders,
    body: JSON.stringify({
      imageUri: `https://nft.cardinal.so/img/?text=${String(
        params.initial
      )}&proxy=true&cluster=mainnet-beta`,
    }),
  };
};
