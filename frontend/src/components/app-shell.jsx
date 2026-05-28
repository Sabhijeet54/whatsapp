"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, History, Send, Settings, LogIn, LogOut, Moon, Sun, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { endpoints } from "@/lib/api";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/login", label: "Login", icon: LogIn },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bulk-sender", label: "Bulk Sender", icon: Send },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ pathname, whatsappStatus, onLogout }) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-8 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur">
        <p className="text-sm text-muted-foreground">WhatsApp Suite</p>
        <h2 className="text-lg font-semibold">Bulk Messaging</h2>
      </div>
      <div className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-4 space-y-2 border-t border-border/40 pt-4">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs text-muted-foreground">Status</span>
          <Badge variant={whatsappStatus === "connected" ? "default" : "secondary"} className="text-xs">
            {whatsappStatus === "connected" ? "Connected" : whatsappStatus === "qr_required" ? "Scan QR" : "Offline"}
          </Badge>
        </div>
        {whatsappStatus === "connected" && (
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-destructive transition hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Logout WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { whatsapp } = useLiveStatus();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const handleLogout = async () => {
    try {
      await endpoints.logout();
      toast.success("Logged out from WhatsApp");
      router.push("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setDark(document.documentElement.classList.contains("dark"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-border/40 bg-card/30 backdrop-blur md:block">
          <SidebarContent pathname={pathname} whatsappStatus={whatsapp.status} onLogout={handleLogout} />
        </aside>
        <main className="flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/40 bg-background/70 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger
                  render={<button type="button" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "md:hidden")} />}
                >
                  <Menu className="h-4 w-4" />
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SidebarContent pathname={pathname} whatsappStatus={whatsapp.status} onLogout={handleLogout} />
                </SheetContent>
              </Sheet>
              <h1 className="text-lg font-semibold">{navItems.find((x) => x.href === pathname)?.label || "Panel"}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={whatsapp.status === "connected" ? "default" : "secondary"} className="hidden text-xs sm:inline-flex">
                {whatsapp.status === "connected" ? "Connected" : "Offline"}
              </Badge>
              <Button variant="outline" size="icon" onClick={toggleTheme}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </header>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
