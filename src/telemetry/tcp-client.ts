import { FTS_TCP_HOSTNAME } from "@/config";

import type {
  TelemetryTcpResult,
  TelemetryTcpSubscriptionPayload,
} from "./types";

import {
  TCP_SUBSCRIPTION_INTERVAL_MS,
  TCP_RECONNECT_DELAY,
  type TelemetryStatus,
} from "./constants";

import { parsePacket, type ParsePacketReturn } from "./parser";

import { StreamBuffer } from "./stream-buffer";
import type { TelemetryData } from "@/types/entities";

type TcpClientOptions = {
  hostname?: string;
  port: number;
  flightId: TelemetryTcpSubscriptionPayload["flightId"];
  intervalMs?: TelemetryTcpSubscriptionPayload["intervalMs"];
  reconnectDelay?: number;

  onData: (data: TelemetryData) => void;
  onStatusChange: (status: TelemetryStatus, message: string) => void;
};

export class TcpClient {
  private hostname: NonNullable<TcpClientOptions["hostname"]>;
  private port: TcpClientOptions["port"];
  private flightId: TcpClientOptions["flightId"];
  private intervalMs: NonNullable<TcpClientOptions["intervalMs"]>;

  private onData: TcpClientOptions["onData"];
  private onStatusChange: TcpClientOptions["onStatusChange"];

  private streamBuffer = new StreamBuffer();

  private socket: Awaited<ReturnType<typeof Bun.connect>> | null = null;
  private isIntentionallyClosed: boolean = false;
  private reconnectDelay: NonNullable<TcpClientOptions["reconnectDelay"]>;
  private reconnectionTimeoutId: Timer | null = null;

  constructor({
    hostname = FTS_TCP_HOSTNAME,
    port,
    flightId,
    intervalMs = TCP_SUBSCRIPTION_INTERVAL_MS,
    reconnectDelay = TCP_RECONNECT_DELAY,

    onData,
    onStatusChange,
  }: TcpClientOptions) {
    this.flightId = flightId;
    this.port = port;
    this.hostname = hostname;
    this.intervalMs = intervalMs;
    this.reconnectDelay = reconnectDelay;

    this.onData = onData;
    this.onStatusChange = onStatusChange;
  }

  private reconnect() {
    // Force close any old connection
    this.socket?.close();

    if (this.isIntentionallyClosed) return;
    if (this.reconnectionTimeoutId) clearTimeout(this.reconnectionTimeoutId);

    this.reconnectionTimeoutId = setTimeout(() => {
      // Reset stream buffer which will be meaningless after a new connection established
      this.streamBuffer = new StreamBuffer();
      this.connect();
    }, this.reconnectDelay);
  }

  public async connect() {
    try {
      this.socket = await Bun.connect({
        hostname: this.hostname,
        port: this.port,

        socket: {
          data: (_, data) => {
            // Sync with the existing buffer stream
            this.streamBuffer.append(data);
            const packetBuffers = this.streamBuffer.extract();

            // If valid packets exits, trigger listeners
            if (packetBuffers.length > 0) {
              const allParsed = packetBuffers.map((buffer) => {
                const parsed = parsePacket(buffer);
                return parsed;
              });

              const latest = allParsed[allParsed.length - 1];

              // If the latest packet is a valid one, trigger onData
              if (latest.status === "VALID") {
                this.onData(latest.data);
              } else {
                // If the latest packet is corrupted, trigger onStatusChange
                this.onStatusChange(latest.status, latest.message);
              }
            }
          },
          open: (socket) => {
            const subscriptionMessage = {
              type: "subscribe",
              flightId: this.flightId,
              intervalMs: this.intervalMs,
            } satisfies TelemetryTcpSubscriptionPayload;

            socket.write(JSON.stringify(subscriptionMessage));
          },
          close: (socket, error) => {
            // TODO: Make error message more meaningful
            this.onStatusChange("CLOSED", "Connection is closed");
            this.reconnect();
          },
          error: (socket, error) => {
            // TODO: Make error message more meaningful
            this.onStatusChange("ERROR", "Connection error.");
            this.reconnect();
          },

          // client-specific handlers
          end: (socket) => {
            // TODO: Make error message more meaningful
            this.onStatusChange("CLOSED", "Connection is closed by server");
            this.reconnect();
          }, // connection closed by server
          timeout: (socket) => {
            // TODO: Make error message more meaningful
            this.onStatusChange("ERROR", "Connection timeout error");
            this.reconnect();
          }, // connection timed out
        },
      });
    } catch (error) {
      // TODO: Make error message more meaningful
      this.onStatusChange("ERROR", "Failed to create connection");
      this.reconnect();
    }
  }

  public async close() {
    if (this.reconnectionTimeoutId) clearTimeout(this.reconnectionTimeoutId);
    this.isIntentionallyClosed = true;
    this.socket?.close();
  }
}
