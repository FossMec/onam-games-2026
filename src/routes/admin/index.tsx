import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";

const AdminView = clientOnly(() =>
  import("~/components/admin/AdminView").then((m) => ({ default: m.AdminView })),
);

export default function Admin() {
  return (
    <>
      <Title>Admin Control Center - Onam Games</Title>
      <Meta name="description" content="Admin console for Onam Games - internal use only." />
      <AdminView fallback={<LoadingScreen message="Loading Admin Console…" />} />
    </>
  );
}
