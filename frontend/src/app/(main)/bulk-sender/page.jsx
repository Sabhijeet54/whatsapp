"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { endpoints } from "@/lib/api";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { useLocalState } from "@/hooks/useLocalState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { LiveLogs, StatCards } from "@/components/dashboard-widgets";

function parseTextContacts(validNumbers = []) {
  return validNumbers.map((number) => ({ number, name: "" }));
}

export default function BulkSenderPage() {
  const { whatsapp, queue } = useLiveStatus();
  const [rawText, setRawText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [invalidNumbers, setInvalidNumbers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("Hi {name}");
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [templates, setTemplates] = useState([]);
  const [senderSettings, setSenderSettings] = useLocalState("sender-settings", {
    minDelayMs: 3000,
    maxDelayMs: 7000,
  });
  const [sending, setSending] = useState(false);

  const filteredContacts = useMemo(() => {
    return contacts.filter((item) => {
      if (!search) return true;
      return item.number.includes(search) || (item.name || "").toLowerCase().includes(search.toLowerCase());
    });
  }, [contacts, search]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    endpoints.getTemplates().then((res) => setTemplates(res.data)).catch(() => {});
  }, []);

  const parseManualText = async () => {
    try {
      const res = await endpoints.parseText(rawText);
      const parsedContacts = parseTextContacts(res.data.validNumbers || []);
      setContacts(parsedContacts);
      setInvalidNumbers(res.data.invalidNumbers || []);
      setSelected(parsedContacts.map((x) => x.number));
      toast.success(`Found ${parsedContacts.length} valid numbers`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to parse numbers");
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    try {
      const res = await endpoints.upload(file);
      const mapped = res.data.mappedContacts || [];
      setContacts(mapped);
      setInvalidNumbers(res.data.invalidNumbers || []);
      setSelected(mapped.map((x) => x.number));
      toast.success(`Imported ${mapped.length} contacts`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Upload failed");
    }
  };

  const removeSelected = () => {
    const set = new Set(selected);
    setContacts((prev) => prev.filter((x) => !set.has(x.number)));
    setSelected([]);
  };

  const sendBulk = async () => {
    if (whatsapp.status !== "connected") {
      toast.error("WhatsApp is not connected. Go to Login first.");
      return;
    }
    if (!selected.length) {
      toast.error("Select at least one contact");
      return;
    }

    // Deduplicate selected contacts
    const uniqueNumbers = [...new Set(selected)];
    const seenNums = new Set();
    const selectedContacts = contacts
      .filter((x) => uniqueNumbers.includes(x.number))
      .filter((x) => { if (seenNums.has(x.number)) return false; seenNums.add(x.number); return true; });

    const formData = new FormData();
    formData.append("numbers", JSON.stringify(selectedContacts));
    formData.append("message", message);
    formData.append("caption", caption);
    formData.append("minDelayMs", String(senderSettings.minDelayMs));
    formData.append("maxDelayMs", String(senderSettings.maxDelayMs));
    if (scheduleAt) formData.append("scheduleAt", scheduleAt);
    if (mediaFile) formData.append("media", mediaFile);

    setSending(true);
    try {
      const res = await endpoints.send(formData);
      toast.success(res.data.message || "Started sending");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to start sending");
    } finally {
      setSending(false);
    }
  };

  const toggleSelection = (number) => {
    setSelected((prev) => (prev.includes(number) ? prev.filter((n) => n !== number) : [...prev, number]));
  };

  const retryFailedFromLive = async () => {
    const numbers = queue.logs
      .filter((item) => item.message.startsWith("Failed for"))
      .map((item) => item.message.replace("Failed for", "").split(":")[0].trim());

    const unique = [...new Set(numbers)];
    if (!unique.length) {
      toast.error("No failed numbers in current run logs");
      return;
    }

    const failedContacts = unique.map((number) => ({ number, name: "" }));
    setContacts(failedContacts);
    setSelected(unique);
    toast.success("Loaded failed numbers for retry");
  };

  return (
    <div className="space-y-4">
      <StatCards queue={queue} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="glass-card xl:col-span-2">
          <CardHeader>
            <CardTitle>Number Input System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Paste numbers (spaces, commas, new lines, mixed formats supported)"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={5}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={parseManualText}>Detect Numbers</Button>
              <Input type="file" accept=".txt,.csv,.xlsx,.xls" onChange={(e) => uploadFile(e.target.files?.[0])} className="max-w-xs" />
              <Button variant="outline" onClick={() => setSelected(filteredContacts.map((x) => x.number))}>Select All</Button>
              <Button variant="outline" onClick={removeSelected}>Remove Selected</Button>
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(invalidNumbers.join("\n"))}>Copy Failed Numbers</Button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge>Total valid: {contacts.length}</Badge>
              <Badge variant="secondary">Invalid: {invalidNumbers.length}</Badge>
            </div>
            <Separator />
            <Input placeholder="Search contacts" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-64 space-y-2 overflow-auto rounded-lg border border-border/30 p-3">
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts loaded</p>
              ) : (
                filteredContacts.map((contact) => (
                  <label key={contact.number} className="flex items-center justify-between rounded-md border border-border/20 px-3 py-2">
                    <div>
                      <p className="font-medium">{contact.number}</p>
                      <p className="text-xs text-muted-foreground">{contact.name || "No name"}</p>
                    </div>
                    <Checkbox checked={selectedSet.has(contact.number)} onCheckedChange={() => toggleSelection(contact.number)} />
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Template title"
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                const title = e.currentTarget.value.trim();
                if (!title) return;
                try {
                  await endpoints.addTemplate({ title, message });
                  const res = await endpoints.getTemplates();
                  setTemplates(res.data);
                  e.currentTarget.value = "";
                  toast.success("Template saved");
                } catch {
                  toast.error("Failed to save template");
                }
              }}
            />
            <select className="h-10 rounded-md border border-input bg-transparent px-3" onChange={(e) => setMessage(e.target.value)}>
              <option value="">Use saved template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.message}>{t.title}</option>
              ))}
            </select>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Type your message with emoji 😊 and variables like {name}" />
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Media caption (optional)" />
            <Input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={senderSettings.minDelayMs}
                onChange={(e) => setSenderSettings((s) => ({ ...s, minDelayMs: Number(e.target.value) || 3000 }))}
                placeholder="Min delay (ms)"
              />
              <Input
                type="number"
                value={senderSettings.maxDelayMs}
                onChange={(e) => setSenderSettings((s) => ({ ...s, maxDelayMs: Number(e.target.value) || 7000 }))}
                placeholder="Max delay (ms)"
              />
            </div>
            <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={sendBulk} disabled={sending || queue.running}>
                {sending ? "Starting..." : queue.running ? "Sending..." : "Bulk Send"}
              </Button>
              <Button variant="outline" onClick={retryFailedFromLive}>Retry Failed</Button>
              <Button variant="outline" onClick={() => endpoints.pauseQueue().then(() => toast.success("Paused"))}>Pause</Button>
              <Button variant="outline" onClick={() => endpoints.resumeQueue().then(() => toast.success("Resumed"))}>Resume</Button>
              <Button variant="destructive" className="col-span-2" onClick={() => endpoints.stopQueue().then(() => toast.success("Stopped"))}>Stop Sending</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <LiveLogs logs={queue.logs} />
    </div>
  );
}
