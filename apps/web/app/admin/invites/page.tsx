import { redirect } from "next/navigation";
import { appUrl } from "@kruxt/ui/app-urls";

// Gym and operator work lives in the platform console; this old web route only forwards there.
export default function Page() {
  redirect(appUrl("platform", "/"));
}
