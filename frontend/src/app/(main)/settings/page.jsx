"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { endpoints } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalState } from "@/hooks/useLocalState";

export default function SettingsPage() {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [senderSettings, setSenderSettings] = useLocalState("sender-settings", {
    minDelayMs: 3000,
    maxDelayMs: 7000,
  });

  const loadContacts = async (q = "") => {
    try {
      const res = await endpoints.getContacts(q);
      setContacts(res.data);
      setContactsLoaded(true);
    } catch {
      toast.error("Failed to load contacts");
    }
  };

  // Only load contacts when user scrolls to or interacts with contacts section
  useEffect(() => {
    if (!contactsLoaded) loadContacts("");
  }, []);

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Sender Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          <Input
            type="number"
            value={senderSettings.minDelayMs}
            onChange={(e) => setSenderSettings((s) => ({ ...s, minDelayMs: Number(e.target.value) || 3000 }))}
            placeholder="Min Delay"
          />
          <Input
            type="number"
            value={senderSettings.maxDelayMs}
            onChange={(e) => setSenderSettings((s) => ({ ...s, maxDelayMs: Number(e.target.value) || 7000 }))}
            placeholder="Max Delay"
          />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search contacts" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <Button variant="outline" onClick={() => loadContacts(search)}>Search</Button>
            <a href={endpoints.exportContacts()} target="_blank" rel="noreferrer">
              <Button variant="outline">Export Contacts</Button>
            </a>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-border/30 p-3">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts available</p>
            ) : (
              contacts.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-border/20 py-2 last:border-none">
                  <p>{item.name || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{item.number}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
