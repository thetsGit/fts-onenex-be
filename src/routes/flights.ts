import type { RouteHandler } from "@/types/http";

import { getFlightsService } from "@/services/flights";

// Proxy api for flight lists
export const getFlights: RouteHandler = async () => {
  try {
    const { response, flights } = await getFlightsService();

    if (response.ok) {
      return Response.json(
        { data: flights, success: "ok", status: response.status },
        {
          status: 200,
        },
      );
    }

    return Response.json(
      { message: "Failed to fetch flights", success: "error", status: 502 },
      { status: 200 },
    );
  } catch {
    return Response.json(
      { message: "Failed to fetch flights", success: "error", status: 502 },
      { status: 502 },
    );
  }
};
