import { getFlightsService } from "@/services/flights";

import { FLIGHT_LIST_SYNC_INTERVAL_MS } from "./constants";

import type { FlightManager } from "./FlightManager";

export async function startTelemetryService(flightManager: FlightManager) {
  async function action() {
    try {
      const { flights } = await getFlightsService();

      flightManager.sync(flights);
    } catch (error) {
      console.error({ error });
    }
  }

  // Initial fetch
  await action();

  // Future periodic polling for periodic flights data sync
  setInterval(action, FLIGHT_LIST_SYNC_INTERVAL_MS);
}
