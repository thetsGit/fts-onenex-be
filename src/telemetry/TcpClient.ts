import { FTS_TCP_HOSTNAME } from "@/config";

import type { TelemetryResult, TelemetryTcpSubscriptionPayload } from "./types";

import {
  TCP_SUBSCRIPTION_INTERVAL_MS,
  TCP_INITIAL_RECONNECT_DELAY_MS,
  TCP_MAX_RECONNECT_DELAY_MS,
} from "./constants";

import { parsePacket } from "./parsePacket";

import { StreamBuffer } from "./StreamBuffer";

type TcpClientOptions = {
  hostname?: string;
  port: number;
  flightId: TelemetryTcpSubscriptionPayload["flightId"];
  intervalMs?: TelemetryTcpSubscriptionPayload["intervalMs"];
  reconnectDelay?: number;

  onData: (data: TelemetryResult) => void;
};

export class TcpClient {
  private _hostname: NonNullable<TcpClientOptions["hostname"]>;
  private _port: TcpClientOptions["port"];
  private _flightId: TcpClientOptions["flightId"];
  private _intervalMs: NonNullable<TcpClientOptions["intervalMs"]>;

  private _onData: TcpClientOptions["onData"];

  private _streamBuffer = new StreamBuffer();

  private _socket: Awaited<ReturnType<typeof Bun.connect>> | null = null;
  private _isIntentionallyClosed: boolean = false;
  private _initialReconnectDelay: NonNullable<
    TcpClientOptions["reconnectDelay"]
  >;
  private _reconnectDelay: NonNullable<TcpClientOptions["reconnectDelay"]>;
  private _reconnectionTimeoutId: Timer | null = null;

  constructor({
    hostname = FTS_TCP_HOSTNAME,
    port,
    flightId,
    intervalMs = TCP_SUBSCRIPTION_INTERVAL_MS,
    reconnectDelay = TCP_INITIAL_RECONNECT_DELAY_MS,

    onData,
  }: TcpClientOptions) {
    this._flightId = flightId;
    this._port = port;
    this._hostname = hostname;
    this._intervalMs = intervalMs;
    this._initialReconnectDelay = reconnectDelay;
    this._reconnectDelay = reconnectDelay;

    this._onData = onData;
  }

  private reconnect() {
    // Force close any old connection
    this._socket?.close();

    if (this._isIntentionallyClosed) return;
    if (this._reconnectionTimeoutId) clearTimeout(this._reconnectionTimeoutId);

    this._reconnectionTimeoutId = setTimeout(() => {
      // Reset stream buffer which will be meaningless after a new connection established
      this._streamBuffer = new StreamBuffer();
      this.connect();

      // Exponential backoff for resource optimization
      this._reconnectDelay = Math.min(
        this._reconnectDelay * 2,
        TCP_MAX_RECONNECT_DELAY_MS,
      );
    }, this._reconnectDelay);
  }

  public async connect() {
    try {
      this._socket = await Bun.connect({
        hostname: this._hostname,
        port: this._port,

        socket: {
          data: (_, data) => {
            // Sync with the existing buffer stream
            this._streamBuffer.append(data);
            const packetBuffers = this._streamBuffer.extract();

            // If valid packets exits, trigger listeners
            if (packetBuffers.length > 0) {
              const allParsed = packetBuffers.map((buffer) => {
                const parsed = parsePacket(buffer);
                return parsed;
              });

              const latest = allParsed[allParsed.length - 1];

              // Trigger onData
              this._onData(latest);
            }
          },
          open: (socket) => {
            const subscriptionMessage = {
              type: "subscribe",
              flightId: this._flightId,
              intervalMs: this._intervalMs,
            } satisfies TelemetryTcpSubscriptionPayload;

            socket.write(JSON.stringify(subscriptionMessage));

            // Reset Exponential backoff on connection success
            this._reconnectDelay = this._initialReconnectDelay;
          },
          close: (socket, error) => {
            // TODO: Make error message more meaningful
            this._onData({
              status: "CLOSED",
              message: "Connection is closed",
            });
            this.reconnect();
          },
          error: (socket, error) => {
            // TODO: Make error message more meaningful
            this._onData({
              status: "ERROR",
              message: "Connection error.",
            });
            this.reconnect();
          },

          // client-specific handlers
          end: (socket) => {
            // TODO: Make error message more meaningful
            this._onData({
              status: "CLOSED",
              message: "Connection is closed by server",
            });
            this.reconnect();
          }, // connection closed by server
          timeout: (socket) => {
            // TODO: Make error message more meaningful
            this._onData({
              status: "ERROR",
              message: "Connection timeout error",
            });
            this.reconnect();
          }, // connection timed out
        },
      });
    } catch (error) {
      // TODO: Make error message more meaningful
      this._onData({
        status: "ERROR",
        message: "Failed to create connection",
      });
      this.reconnect();
    }
  }

  public async close() {
    if (this._reconnectionTimeoutId) clearTimeout(this._reconnectionTimeoutId);
    this._isIntentionallyClosed = true;
    this._socket?.close();
  }
}
