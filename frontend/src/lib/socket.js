"use client";

import { io } from "socket.io-client";
import { SOCKET_URL } from "./constants";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
