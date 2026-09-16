import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/workspace")({
  head: () => ({ meta: [{ title: "Workspace — MelaBridge" }, { name: "robots", content: "noindex" }] }),
  component: () => <Navigate to="/admin" replace />,
});
