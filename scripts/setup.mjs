import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const secret = () => randomBytes(32).toString("base64url");
const content = `ADMIN_PASSWORD=${secret()}
SESSION_SECRET=${secret()}
MAGIC_LINK_SECRET=${secret()}
DEV_SHOW_MAGIC_LINKS=1
`;
try {
  await writeFile(".dev.vars", content, { flag: "wx", mode: 0o600 });
  console.log("Created .dev.vars with unique local credentials. Read ADMIN_PASSWORD there to sign in.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(".dev.vars already exists; kept your existing credentials. See .dev.vars.example for required settings.");
}
