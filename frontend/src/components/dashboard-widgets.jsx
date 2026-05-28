"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function StatCards({ queue }) {
  const progress = queue.total ? Math.round(((queue.sent + queue.failed) / queue.total) * 100) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {["total", "sent", "failed", "pending"].map((key) => (
        <Card key={key} className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm capitalize">{key}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{queue[key] || 0}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="glass-card md:col-span-2 xl:col-span-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sending Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress}% completed</span>
            <Badge variant={queue.running ? "default" : "secondary"}>{queue.paused ? "Paused" : queue.running ? "Running" : "Idle"}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function LiveLogs({ logs = [] }) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Live Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 rounded-md border border-border/30 p-3">
          <div className="space-y-2 text-sm">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">No logs yet</p>
            ) : (
              logs.slice(-100).reverse().map((log, idx) => (
                <div key={`${log.time}-${idx}`} className="rounded-lg border border-border/20 bg-card/40 px-3 py-2">
                  <p className="font-medium">{log.message}</p>
                  <p className="text-xs text-muted-foreground">{new Date(log.time).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
