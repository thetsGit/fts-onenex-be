import type { Flight } from "@/types/entities";

import { getWsTelemetryTopic } from "@/config";

import { TcpClient } from "./TcpClient";

type FlightManagerOptions = {
  server: Bun.Server<unknown>;
  flights?: Flight[];
};

export class FlightManager {
  private _server: Bun.Server<unknown> | null = null;
  private _flights: Flight[] = [];
  private _tcpClients: Map<Flight["id"], TcpClient> = new Map();

  constructor({ server, flights }: FlightManagerOptions) {
    this._server = server;
    if (flights) this.addMany(flights);
  }

  private addMany(flightsToAdd: Flight[]) {
    // Append the new list to the global list
    this._flights.push(...flightsToAdd);

    flightsToAdd.forEach((flight) => {
      const { telemetryPort: port, id: flightId } = flight;

      const tcpClient = new TcpClient({
        port,
        flightId,
        onData: (result) => {
          this._server?.publish(
            getWsTelemetryTopic(flightId),
            JSON.stringify(result),
          );
        },
      });

      // Open new tcp connection for each new flight
      tcpClient.connect();

      // Sync new tcp connection with global tcp list
      this._tcpClients.set(flightId, tcpClient);
    });
  }

  private removeMany(flightsToRemove: Flight[]) {
    // Remove flights from the global list
    this._flights = this._flights.filter(
      (activeFlight) =>
        !flightsToRemove.find(
          ({ id: idToRemove }) => activeFlight["id"] === idToRemove,
        ),
    );

    // Also close tcp connections of the removed flights
    flightsToRemove.forEach(({ id: idToRemove }) => {
      if (this._tcpClients.has(idToRemove)) {
        this._tcpClients.get(idToRemove)?.close();
        this._tcpClients.delete(idToRemove);
      }
    });
  }

  public sync(upToDateFlights: Flight[]) {
    const flightsToAdd = upToDateFlights.filter(
      (flight) =>
        !this._flights.find(
          ({ id: existingId }) => existingId === flight["id"],
        ),
    );

    const flightsToRemove = this._flights.filter(
      (existingFlight) =>
        !upToDateFlights.find(({ id }) => existingFlight["id"] === id),
    );

    this.addMany(flightsToAdd);
    this.removeMany(flightsToRemove);
  }

  public get flights() {
    return this._flights;
  }
}
