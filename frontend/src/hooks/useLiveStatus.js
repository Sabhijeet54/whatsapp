"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

export function useLiveStatus() {
  const [whatsapp, setWhatsapp] = useState({ status: "disconnected", qrCode: null });
  const [queue, setQueue] = useState({ sent: 0, failed: 0, pending: 0, total: 0, logs: [], running: false, paused: false });

  useEffect(() => {
    const socket = getSocket();
    const onWhatsapp = (payload) => setWhatsapp((prev) => ({ ...prev, ...payload }));
    const onQueueStats = (payload) => setQueue(payload);
    const onQueueLog = (payload) => {
      setQueue((prev) => ({ ...prev, logs: [...(prev.logs || []), payload].slice(-200) }));
    };

    socket.on("whatsapp:status", onWhatsapp);
    socket.on("queue:stats", onQueueStats);
    socket.on("queue:log", onQueueLog);

    return () => {
      socket.off("whatsapp:status", onWhatsapp);
      socket.off("queue:stats", onQueueStats);
      socket.off("queue:log", onQueueLog);
    };
  }, []);

  return { whatsapp, queue };
}
