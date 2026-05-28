"use client";

import { useLiveStatus } from "@/hooks/useLiveStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveLogs, StatCards } from "@/components/dashboard-widgets";

export default function DashboardPage() {
  const { whatsapp, queue } = useLiveStatus();

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Live WhatsApp Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Connection is tracked in real-time using socket.io</p>
          <Badge variant={whatsapp.status === "connected" ? "default" : "secondary"}>{whatsapp.status}</Badge>
        </CardContent>
      </Card>
      <StatCards queue={queue} />
      <LiveLogs logs={queue.logs} />
    </div>
  );
}
