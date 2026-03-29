export type MemoryUsageSignal = {
  type: "memory";
  rss: number;
};

export const isMemoryUsageSignal = (
  message: unknown,
): message is MemoryUsageSignal => {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "memory"
  );
};
