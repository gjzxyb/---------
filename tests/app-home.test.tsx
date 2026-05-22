import { describe, expect, it, vi } from "vitest";
import Home from "../app/page";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("Home page", () => {
  it("redirects to the authenticated dashboard entry", () => {
    Home();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
