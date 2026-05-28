const { randomUUID } = require("crypto");
const config = require("../config");
const { readJson, writeJson } = require("../utils/jsonStore");

function listContacts() {
  return readJson(config.contactsFile, []);
}

function saveContacts(contacts = []) {
  const existing = readJson(config.contactsFile, []);
  const map = new Map(existing.map((item) => [item.number, item]));

  contacts.forEach((contact) => {
    if (!contact?.number) return;
    map.set(contact.number, {
      id: map.get(contact.number)?.id || randomUUID(),
      number: contact.number,
      name: contact.name || map.get(contact.number)?.name || "",
      updatedAt: new Date().toISOString(),
    });
  });

  const merged = Array.from(map.values());
  writeJson(config.contactsFile, merged);
  return merged;
}

function exportContactsCsv() {
  const contacts = listContacts();
  const rows = ["name,number", ...contacts.map((c) => `${(c.name || "").replace(/,/g, " ")},${c.number}`)];
  return rows.join("\n");
}

function listTemplates() {
  return readJson(config.templatesFile, []);
}

function addTemplate(template) {
  const templates = readJson(config.templatesFile, []);
  const item = {
    id: randomUUID(),
    title: template.title,
    message: template.message,
    createdAt: new Date().toISOString(),
  };
  templates.push(item);
  writeJson(config.templatesFile, templates);
  return item;
}

function deleteTemplate(id) {
  const templates = readJson(config.templatesFile, []);
  const filtered = templates.filter((item) => item.id !== id);
  writeJson(config.templatesFile, filtered);
}

module.exports = {
  listContacts,
  saveContacts,
  exportContactsCsv,
  listTemplates,
  addTemplate,
  deleteTemplate,
};
