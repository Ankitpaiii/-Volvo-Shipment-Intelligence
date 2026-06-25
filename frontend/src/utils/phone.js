const PHONE_REGEX = /^\+[1-9]\d{9,14}$/;

export function parsePhoneList(rawInput) {
  const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
  const valid = [];
  const invalid = [];
  
  lines.forEach(line => {
    if (PHONE_REGEX.test(line)) {
      valid.push(line);
    } else {
      invalid.push(line);
    }
  });
  
  return { valid, invalid };
}
