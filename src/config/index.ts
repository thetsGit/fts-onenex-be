// Http server
export const FTS_BASE_API_URL = Bun.env.FTS_API_BASE_URL;
export const FTS_API_PORT = Bun.env.FTS_API_PORT;
export const FTS_API_URL = `${FTS_BASE_API_URL}:${FTS_API_PORT}`;
export const FLIGHTS_ENDPOINT = `${FTS_API_URL}/flights`;

// Tcp server
export const FTS_TCP_HOSTNAME = Bun.env.FTS_TCP_HOSTNAME;
