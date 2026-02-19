import { serviceClient } from "./supabase.ts";

export async function isFlagEnabled(flagKey: string): Promise<boolean> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", flagKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.enabled);
}
