"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { endpoints } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HistoryPage() {
  const [history, setHistory] = useState([]);

  const load = async () => {
    try {
      const res = await endpoints.getHistory();
      setHistory(res.data);
    } catch {
      toast.error("Failed to load history");
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Message History</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={load} variant="outline">Refresh</Button>
          <a href={endpoints.exportHistory()} target="_blank" rel="noreferrer">
            <Button variant="outline">Export History</Button>
          </a>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {history.length === 0 ? (
          <Card className="glass-card"><CardContent className="py-10 text-center text-muted-foreground">No history yet</CardContent></Card>
        ) : (
          history.map((item) => (
            <Card key={item.id} className="glass-card">
              <CardContent className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{item.message?.slice(0, 90) || "Media message"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>Total: {item.total || 0}</Badge>
                  <Badge>Sent: {item.sent || 0}</Badge>
                  <Badge variant="secondary">Failed: {item.failed || 0}</Badge>
                  <Badge variant="outline">{item.status || "unknown"}</Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
