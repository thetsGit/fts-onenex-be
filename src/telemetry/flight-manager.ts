import type { Flight } from "@/types/entities";

import { getWsTelemetryTopic } from "./constants";

import { TcpClient } from "./tcp-client";

type FlightManagerOptions = {
  server: Bun.Server<unknown>;
  flights?: Flight[];
};

export class FlightManager {
  private server: Bun.Server<unknown> | null = null;
  private flights: Flight[] = [];
  private tcpClients: Map<Flight["id"], TcpClient> = new Map();

  constructor({ server, flights }: FlightManagerOptions) {
    this.server = server;
    if (flights) this.addMany(flights);
  }

  private addMany(flightsToAdd: Flight[]) {
    // Append the new list to the global list
    this.flights.push(...flightsToAdd);

    flightsToAdd.forEach((flight) => {
      const { telemetryPort: port, id: flightId } = flight;

      const tcpClient = new TcpClient({
        port,
        flightId,
        onData: (result) => {
          this.server?.publish(
            getWsTelemetryTopic(flightId),
            JSON.stringify(result),
          );
        },
      });

      // Open new tcp connection for each new flight
      tcpClient.connect();

      // Sync new tcp connection with global tcp list
      this.tcpClients.set(flightId, tcpClient);
    });
  }

  private removeMany(flightsToRemove: Flight[]) {
    // Remove flights from the global list
    this.flights = this.flights.filter(
      (activeFlight) =>
        !flightsToRemove.find(
          ({ id: idToRemove }) => activeFlight["id"] === idToRemove,
        ),
    );

    // Also close tcp connections of the removed flights
    flightsToRemove.forEach(({ id: idToRemove }) => {
      if (this.tcpClients.has(idToRemove)) {
        this.tcpClients.get(idToRemove)?.close();
        this.tcpClients.delete(idToRemove);
      }
    });
  }

  public sync(upToDateFlights: Flight[]) {
    const flightsToAdd = upToDateFlights.filter(
      (flight) =>
        !this.flights.find(({ id: existingId }) => existingId === flight["id"]),
    );

    const flightsToRemove = this.flights.filter(
      (existingFlight) =>
        !upToDateFlights.find(({ id }) => existingFlight["id"] === id),
    );

    this.addMany(flightsToAdd);
    this.removeMany(flightsToRemove);
  }
}
