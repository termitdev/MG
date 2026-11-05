import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";
const config = loadEnv("development", process.cwd(), "");
const result = {};
const testEmail = process.argv[2]?.trim().toLowerCase();
if (testEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail))
  throw new Error("Provide a valid authorized test email address.");
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const schema = await supabase.from("profiles").select("invitation_pending").limit(0);
result.invitationSchemaReady = !schema.error;
result.schemaErrorCode = schema.error?.code;
let found = false,
  complete = false;
for (let page = 1; testEmail && page <= 20; page++) {
  const r = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (r.error) {
    result.authCheck = "unavailable";
    break;
  }
  if (r.data.users.some((u) => u.email?.toLowerCase() === testEmail)) {
    found = true;
    complete = true;
    break;
  }
  if (r.data.users.length < 1000) {
    complete = true;
    break;
  }
}
result.authorizedTestAddressExists = found;
result.accountLookupComplete = complete;
const token = config.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
result.managementAccessAvailable = Boolean(token);
if (token) {
  const ref = new URL(config.SUPABASE_URL).hostname.split(".")[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  result.managementStatus = response.status;
  if (response.ok) {
    const c = await response.json();
    result.smtp = {
      resend: c.smtp_host === "smtp.resend.com",
      senderMatches: c.smtp_admin_email === "acesso@muguitoxicologico.com.br",
      nameMatches: c.smtp_sender_name === "MUGUI",
      inviteTemplateUsesConfirmationURL: String(c.mailer_templates_invite_content || "").includes(
        "{{ .ConfirmationURL }}",
      ),
    };
  }
}
console.log(JSON.stringify(result));
