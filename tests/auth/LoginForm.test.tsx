import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginForm from "../../app/(auth)/login/LoginForm";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: mocks.signIn,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

const failureMessage = "登录失败，请检查账号和密码";

async function submitLoginForm() {
  render(<LoginForm />);

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "admin@example.edu" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Password123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an error and does not redirect when signIn returns undefined", async () => {
    mocks.signIn.mockResolvedValue(undefined);

    await submitLoginForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(failureMessage);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows an error and restores loading state when signIn throws", async () => {
    mocks.signIn.mockRejectedValue(new Error("network failure"));

    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(failureMessage);
    });
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
