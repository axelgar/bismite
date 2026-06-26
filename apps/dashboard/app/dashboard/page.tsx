import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listProjects } from "@/lib/counter";
import { CreateProject } from "./create-project";
import { SignOut } from "./sign-out";

export default async function Dashboard() {
  const user = await requireUser();
  // Degrade gracefully: a counter outage/misconfig shows a banner, not a white-screen 500.
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let loadError = false;
  try {
    projects = await listProjects(user.id);
  } catch {
    loadError = true;
  }

  return (
    <main>
      <div className="row">
        <h1>Projects</h1>
        <span className="muted">{user.email} · <SignOut /></span>
      </div>

      {loadError && (
        <p className="error">Couldn’t reach the counter service. Check it’s up and that this dashboard’s ADMIN_TOKEN matches the counter’s.</p>
      )}

      <CreateProject />

      {projects.length === 0 ? (
        <p className="muted">No projects yet — create one above to get your API keys.</p>
      ) : (
        projects.map((p) => (
          <Link key={p.projectId} href={`/dashboard/${p.projectId}`} style={{ textDecoration: "none" }}>
            <div className="card row">
              <div>
                <strong style={{ color: "var(--fg)" }}>{p.name || p.projectId}</strong>
                <div className="muted">{p.projectId}</div>
              </div>
              <span className="muted">{p.keys.length} keys →</span>
            </div>
          </Link>
        ))
      )}
    </main>
  );
}
