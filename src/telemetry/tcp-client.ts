import { FTS_TCP_HOSTNAME } from "@/config";

import type { TelemetryResult, TelemetryTcpSubscriptionPayload } from "./types";

import {
  TCP_SUBSCRIPTION_INTERVAL_MS,
  TCP_INITIAL_RECONNECT_DELAY_MS,
  TCP_MAX_RECONNECT_DELAY_MS,
} from "./constants";

import { parsePacket } from "./parser";

import { StreamBuffer } from "./stream-buffer";

type TcpClientOptions = {
  hostname?: string;
  port: number;
  flightId: TelemetryTcpSubscriptionPayload["flightId"];
  intervalMs?: TelemetryTcpSubscriptionPayload["intervalMs"];
  reconnectDelay?: number;

  onData: (data: TelemetryResult) => void;
};

export class TcpClient {
  private hostname: NonNullable<TcpClientOptions["hostname"]>;
  private port: TcpClientOptions["port"];
  private flightId: TcpClientOptions["flightId"];
  private intervalMs: NonNullable<TcpClientOptions["intervalMs"]>;

  private onData: TcpClientOptions["onData"];

  private streamBuffer = new StreamBuffer();

  private socket: Awaited<ReturnType<typeof Bun.connect>> | null = null;
  private isIntentionallyClosed: boolean = false;
  private initialReconnectDelay: NonNullable<
    TcpClientOptions["reconnectDelay"]
  >;
  private reconnectDelay: NonNullable<TcpClientOptions["reconnectDelay"]>;
  private reconnectionTimeoutId: Timer | null = null;

  constructor({
    hostname = FTS_TCP_HOSTNAME,
    port,
    flightId,
    intervalMs = TCP_SUBSCRIPTION_INTERVAL_MS,
    reconnectDelay = TCP_INITIAL_RECONNECT_DELAY_MS,

    onData,
  }: TcpClientOptions) {
    this.flightId = flightId;
    this.port = port;
    this.hostname = hostname;
    this.intervalMs = intervalMs;
    this.initialReconnectDelay = reconnectDelay;
    this.reconnectDelay = reconnectDelay;

    this.onData = onData;
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

      // Exponential backoff for resource optimization
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        TCP_MAX_RECONNECT_DELAY_MS,
      );
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

              // Trigger onData
              this.onData(latest);
            }
          },
          open: (socket) => {
            const subscriptionMessage = {
              type: "subscribe",
              flightId: this.flightId,
              intervalMs: this.intervalMs,
            } satisfies TelemetryTcpSubscriptionPayload;

            socket.write(JSON.stringify(subscriptionMessage));

            // Reset Exponential backoff on connection success
            this.reconnectDelay = this.initialReconnectDelay;
          },
          close: (socket, error) => {
            // TODO: Make error message more meaningful
            this.onData({
              status: "CLOSED",
              message: "Connection is closed",
            });
            this.reconnect();
          },
          error: (socket, error) => {
            // TODO: Make error message more meaningful
            this.onData({
              status: "ERROR",
              message: "Connection error.",
            });
            this.reconnect();
          },

          // client-specific handlers
          end: (socket) => {
            // TODO: Make error message more meaningful
            this.onData({
              status: "CLOSED",
              message: "Connection is closed by server",
            });
            this.reconnect();
          }, // connection closed by server
          timeout: (socket) => {
            // TODO: Make error message more meaningful
            this.onData({
              status: "ERROR",
              message: "Connection timeout error",
            });
            this.reconnect();
          }, // connection timed out
        },
      });
    } catch (error) {
      // TODO: Make error message more meaningful
      this.onData({
        status: "ERROR",
        message: "Failed to create connection",
      });
      this.reconnect();
    }
  }

  public async close() {
    if (this.reconnectionTimeoutId) clearTimeout(this.reconnectionTimeoutId);
    this.isIntentionallyClosed = true;
    this.socket?.close();
  }
}
