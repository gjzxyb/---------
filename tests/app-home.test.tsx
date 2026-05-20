import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../app/page";

describe("Home page", () => {
  it("renders the scaffold title and stack summary", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "智慧评教与反馈平台" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Next\.js App Router/)).toBeInTheDocument();
  });
});
