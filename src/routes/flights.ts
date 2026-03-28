import { getFlightsService } from "@/services/flights";
import type { RouteHandler } from "@/types/http";

// Proxy api for flight lists
export const getFlights: RouteHandler = async () => {
  try {
    const { response, flights } = await getFlightsService();
    return Response.json(flights, {
      status: response.status,
    });
  } catch (error) {
    return Response.json(
      { message: "Failed to fetch flights" },
      { status: 502 },
    );
  }
};
