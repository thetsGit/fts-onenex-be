import { FLIGHTS_ENDPOINT } from "@/config";

import { type Flight } from "@/types/entities";

export const getFlightsService = async () => {
  const response = await fetch(FLIGHTS_ENDPOINT);
  let flights: Flight[] | null = null;

  if (response.ok) {
    flights = (await response.json()) as Flight[];
  }

  return { response, flights };
};
