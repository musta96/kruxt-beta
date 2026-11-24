import { appUrl } from "@kruxt/ui/app-urls";

export function getGymAdminLoginUrl(): string {
  return appUrl("admin", "/login");
}
