import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PageTransition } from "../PageTransition";

describe("PageTransition", () => {
  it("renders children inside Outlet context", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<PageTransition />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(getByText("Home")).toBeInTheDocument();
  });
});