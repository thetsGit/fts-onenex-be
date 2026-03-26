import { FLIGHTS_ENDPOINT } from "@/config";

import { type Flight } from "@/types/entities";

export async function getFlights() {
  try {
    const response = await fetch(FLIGHTS_ENDPOINT);
    const data = (await response.json()) as Flight[];
    return Response.json(data, { status: response.status });
  } catch (error) {
    return Response.json(
      { message: "Failed to fetch flights" },
      { status: 502 },
    );
  }
}
