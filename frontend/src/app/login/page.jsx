"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { endpoints } from "@/lib/api";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusMap = {
  connected: "Connected",
  qr_required: "Scan QR",
  loading: "Loading",
  authenticated: "Authenticated",
  disconnected: "Disconnected",
  reconnect_failed: "Reconnect Failed",
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { whatsapp } = useLiveStatus();
  const router = useRouter();
  const autoStarted = useRef(false);

  const startLogin = useCallback(async () => {
    try {
      setLoading(true);
      await endpoints.login();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to initialize login");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-start WhatsApp login when page opens so QR appears by default
  useEffect(() => {
    if (whatsapp.status === "connected") {
      router.push("/dashboard");
      return;
    }
    if ((whatsapp.status === "disconnected" || whatsapp.status === "reconnect_failed") && !autoStarted.current) {
      autoStarted.current = true;
      startLogin();
    }
  }, [whatsapp.status, router, startLogin]);

  const logout = async () => {
    try {
      await endpoints.logout();
      toast.success("Logged out");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Logout failed");
    }
  };

  const waitingForQr = loading || ["loading", "authenticated"].includes(whatsapp.status) || (autoStarted.current && whatsapp.status === "disconnected" && !whatsapp.qrCode);

  const canStartLogin = !loading && whatsapp.status !== "connected" && !waitingForQr;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>WhatsApp Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={whatsapp.status === "connected" ? "default" : "secondary"}>{statusMap[whatsapp.status] || whatsapp.status}</Badge>
              <Button onClick={startLogin} disabled={!canStartLogin}>
                {loading ? "Starting..." : "Start Login"}
              </Button>
              <Button variant="outline" onClick={logout}>Logout</Button>
            </div>
            {waitingForQr && !whatsapp.qrCode && (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Initializing WhatsApp... QR code loading.</p>
              </div>
            )}
            {whatsapp.qrCode && (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl border border-border/40 bg-card/40 p-4">
                  <Image src={whatsapp.qrCode} alt="WhatsApp QR" className="h-64 w-64 rounded-lg" width={256} height={256} />
                </div>
                <p className="text-sm text-muted-foreground">Scan this QR code with WhatsApp on your phone.</p>
              </div>
            )}
            {!waitingForQr && !whatsapp.qrCode && whatsapp.status === "reconnect_failed" && (
              <p className="text-sm text-destructive">Connection failed. Click "Start Login" to try again.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
