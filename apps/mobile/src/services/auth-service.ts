import type { SupabaseClient, User } from "@supabase/supabase-js";

import { KruxtAppError, throwIfError } from "./errors";

export interface CredentialsInput {
  email: string;
  password: string;
}

export class MobileAuthService {
  constructor(private readonly supabase: SupabaseClient) {}

  async signUpWithPassword(input: CredentialsInput): Promise<User> {
    const { data, error } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password
    });

    throwIfError(error, "AUTH_SIGNUP_FAILED", "Unable to sign up.");

    if (!data.user) {
      throw new KruxtAppError("AUTH_SIGNUP_NO_USER", "Sign-up completed without a user payload.");
    }

    return data.user;
  }

  async signInWithPassword(input: CredentialsInput): Promise<User> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password
    });

    throwIfError(error, "AUTH_SIGNIN_FAILED", "Unable to sign in.");

    if (!data.user) {
      throw new KruxtAppError("AUTH_SIGNIN_NO_USER", "Sign-in completed without a user payload.");
    }

    return data.user;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    throwIfError(error, "AUTH_SIGNOUT_FAILED", "Unable to sign out.");
  }

  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await this.supabase.auth.getUser();
    throwIfError(error, "AUTH_GET_USER_FAILED", "Unable to read current user.");
    return data.user;
  }

  async requireCurrentUserId(): Promise<string> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new KruxtAppError("AUTH_REQUIRED", "Authentication required.");
    }

    return user.id;
  }
}
