// BridgeDNA™ has been retired. Redirects to the dashboard.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bridgedna")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
  component: () => null,
});
