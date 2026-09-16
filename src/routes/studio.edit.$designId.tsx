// BridgeStudio™ editor is temporarily unavailable. Redirects to the dashboard.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/studio/edit/$designId")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
  component: () => null,
});
