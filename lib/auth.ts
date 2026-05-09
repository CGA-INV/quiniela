export const ADMIN_EMAIL = "montagudev@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
