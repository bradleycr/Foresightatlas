import type { Person } from "../types";

const API_BASE = "";

export interface DirectoryAuthResult {
  person: Person;
  auth: {
    token: string;
    expiresAt: string;
    mustChangePassword: boolean;
  };
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error ||
        response.statusText ||
        "Request failed",
    );
  }

  return payload as T;
}

export async function authenticateDirectoryMember(
  username: string,
  password: string,
): Promise<DirectoryAuthResult> {
  return postJson<DirectoryAuthResult>(`${API_BASE}/api/member-login`, {
    username,
    password,
  });
}

export async function changeDirectoryPassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<DirectoryAuthResult> {
  return postJson<DirectoryAuthResult>(
    `${API_BASE}/api/member-password`,
    {
      currentPassword,
      newPassword,
    },
    token,
  );
}
