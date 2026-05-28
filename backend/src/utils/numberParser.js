const INDIAN_MOBILE_REGEX = /(?:\+?91[-\s]?)?[6-9]\d{9}/g;

function normalizeToIndianNumber(raw, defaultCountryCode = "91") {
  if (!raw) return null;

  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `${defaultCountryCode}${digits}`;
  }

  if (digits.length === 12 && digits.startsWith(defaultCountryCode) && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return digits;
  }

  if (digits.length > 12 && digits.endsWith(defaultCountryCode)) {
    return null;
  }

  if (digits.length > 10) {
    const tailTen = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(tailTen)) {
      return `${defaultCountryCode}${tailTen}`;
    }
  }

  return null;
}

function parseNumbersFromText(text = "", defaultCountryCode = "91") {
  const matches = text.match(INDIAN_MOBILE_REGEX) || [];
  const looseTokens = text.split(/[\s,;|\n\r\t]+/).filter(Boolean);

  const candidates = [...matches, ...looseTokens];

  const validSet = new Set();
  const invalid = [];

  candidates.forEach((item) => {
    const normalized = normalizeToIndianNumber(item, defaultCountryCode);
    if (normalized) {
      validSet.add(normalized);
    } else if (String(item).replace(/\D/g, "").length >= 10) {
      invalid.push(String(item).trim());
    }
  });

  return {
    validNumbers: Array.from(validSet),
    invalidNumbers: Array.from(new Set(invalid)),
  };
}

function applyNameVariable(message, contact) {
  const fallbackName = contact?.name || "there";
  return message.replaceAll("{name}", fallbackName);
}

module.exports = {
  parseNumbersFromText,
  normalizeToIndianNumber,
  applyNameVariable,
};
