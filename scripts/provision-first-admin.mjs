// Run manually in a trusted environment. Never run this from an HTTP endpoint.
import { createClient } from "@supabase/supabase-js";
import { inspectAuthConfiguration } from "../src/lib/backend-config.ts";
const [email, fullName] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_ORIGIN } = process.env;
if (!email || !fullName || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !APP_ORIGIN) {
  console.error(
    'Configure the backend environment, then run: node scripts/provision-first-admin.mjs "email" "full name"',
  );
  process.exit(1);
}
const issues = inspectAuthConfiguration(process.env, true);
if (issues.length) {
  console.error("Provisioning refused: invalid backend configuration.", issues);
  process.exit(1);
}
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { count, error: queryError } = await client
  .from("profiles")
  .select("id", { count: "exact", head: true })
  .eq("role", "admin");
if (queryError || count !== 0) {
  console.error("Provisioning refused: check the migration or use an existing administrator.");
  process.exit(1);
}
const { data, error } = await client.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});
if (error || !data.user) {
  console.error("Invitation failed. Review the provider's protected administrative logs.");
  process.exit(1);
}
const { error: profileError } = await client.from("profiles").upsert({
  id: data.user.id,
  full_name: fullName,
  email,
  role: "admin",
  active: true,
  can_view_sensitive: true,
});
if (profileError) {
  console.error(
    "Profile creation failed. The invited account has no access. Resolve it in the protected Supabase console before retrying.",
  );
  process.exit(1);
}
const { error: auditError } = await client.from("audit_logs").insert({
  actor_id: data.user.id,
  action: "staff.first_admin_provisioned",
  resource_type: "profile",
  resource_id: data.user.id,
});
if (auditError) {
  console.error("Administrator created, but its provisioning audit requires manual investigation.");
  process.exit(1);
}
console.log(
  "Administrator created with confirmed email. A personal password and verified MFA are required before accessing the dashboard.",
);
const { error: deliveryError } = await client.auth.resetPasswordForEmail(email, {
  redirectTo: `${APP_ORIGIN}/login?redefinir=1`,
});
if (deliveryError) {
  console.error(
    "Account created, but password setup email could not be sent. Correct SMTP/templates and request password recovery; do not rerun account creation.",
  );
  process.exit(1);
}
