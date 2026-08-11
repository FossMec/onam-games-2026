import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { getMe } from "~/server/auth/actions";
import {
  addTester,
  blockIpAction,
  getAdminDashboard,
  setTesterActive,
  setUserBlock,
  setUserRole,
  unblockIpAction,
  updateSetting,
} from "~/server/admin/actions";

export default function Admin() {
  const me = createAsync(() => getMe());
  const [version, setVersion] = createSignal(0);
  const reload = () => setVersion((v) => v + 1);
  const data = createAsync(async () => {
    void version();
    if (me()?.role !== "admin") return null;
    return getAdminDashboard();
  });

  const [blockIpInput, setBlockIpInput] = createSignal("");
  const [testerEmail, setTesterEmail] = createSignal("");
  const [message, setMessage] = createSignal("");

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      setMessage(success);
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed");
    }
  };

  return (
    <main>
      <Title>Admin — FOSS Onam Games</Title>
      <h1>Admin</h1>
      <Show when={message()}>
        <p>{message()}</p>
      </Show>

      <Show when={!me() || me()!.role !== "admin"}>
        <p>You don't have access to this page.</p>
      </Show>

      <Show when={me()?.role === "admin" && data()}>
        <section>
          <h2>Settings</h2>
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Group</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <For each={data()!.settings}>
                {(setting) => (
                  <tr>
                    <td>{setting.key}</td>
                    <td>{String(JSON.stringify(setting.value))}</td>
                    <td>{setting.group}</td>
                    <td>
                      <button
                        type="button"
                        onClick={async () => {
                          const raw = prompt(
                            `New value for ${setting.key}`,
                            JSON.stringify(setting.value),
                          );
                          if (raw === null) return;
                          try {
                            const parsed = JSON.parse(raw);
                            await run(
                              () =>
                                updateSetting(
                                  setting.key,
                                  parsed,
                                  setting.group,
                                  setting.description ?? undefined,
                                ),
                              "Setting updated",
                            );
                          } catch {
                            setMessage("Value must be valid JSON");
                          }
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Users</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>College</th>
                <th>Role</th>
                <th>Trust</th>
                <th>Streak</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <For each={data()!.users}>
                {(user) => (
                  <tr>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      {user.college ?? "-"}
                      {user.branch ? ` · ${user.branch}` : ""}
                      {user.batch ? ` · ${user.batch}` : ""}
                    </td>
                    <td>
                      <select
                        value={user.role ?? "player"}
                        onChange={(e) =>
                          run(
                            () =>
                              setUserRole(
                                user.id,
                                e.currentTarget.value as "player" | "tester" | "admin",
                              ),
                            "Role updated",
                          )
                        }
                      >
                        <option value="player">player</option>
                        <option value="tester">tester</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>{user.trustScore}</td>
                    <td>{user.streakCount}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            () => setUserBlock(user.id, !user.isBlocked, "by admin"),
                            user.isBlocked ? "Unblocked" : "Blocked",
                          )
                        }
                      >
                        {user.isBlocked ? "Unblock" : "Block"}
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Testers</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => addTester(testerEmail()), "Tester added");
              setTesterEmail("");
            }}
          >
            <input
              type="email"
              placeholder="tester@example.com"
              value={testerEmail()}
              onChange={(e) => setTesterEmail(e.currentTarget.value)}
              required
            />
            <button type="submit">Add tester</button>
          </form>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Early hours</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <For each={data()!.testers}>
                {(tester) => (
                  <tr>
                    <td>{tester.email}</td>
                    <td>{tester.earlyHours}</td>
                    <td>{tester.active ? "yes" : "no"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          run(() => setTesterActive(tester.id, !tester.active), "Tester toggled")
                        }
                      >
                        {tester.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Blocked IPs</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => blockIpAction({ ip: blockIpInput() }), "IP blocked");
              setBlockIpInput("");
            }}
          >
            <input
              type="text"
              placeholder="1.2.3.4"
              value={blockIpInput()}
              onChange={(e) => setBlockIpInput(e.currentTarget.value)}
              required
            />
            <button type="submit">Block IP</button>
          </form>
          <table>
            <thead>
              <tr>
                <th>IP</th>
                <th>Reason</th>
                <th>Scope</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <For each={data()!.blockedIps}>
                {(row) => (
                  <tr>
                    <td>{row.ip}</td>
                    <td>{row.reason ?? "-"}</td>
                    <td>{row.scope}</td>
                    <td>{row.expiresAt?.toISOString() ?? "never"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => run(() => unblockIpAction(row.ip), "IP unblocked")}
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Suspicious activity</h2>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Action</th>
                <th>User</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              <For each={data()!.suspicious}>
                {(row) => (
                  <tr>
                    <td>{row.createdAt.toISOString()}</td>
                    <td>{row.eventType}</td>
                    <td>{row.severity}</td>
                    <td>{row.actionTaken}</td>
                    <td>{row.userEmail ?? "-"}</td>
                    <td>{row.ip ?? "-"}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Activity log</h2>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>User</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              <For each={data()!.activity}>
                {(row) => (
                  <tr>
                    <td>{row.createdAt.toISOString()}</td>
                    <td>{row.eventType}</td>
                    <td>{row.userEmail ?? "-"}</td>
                    <td>{row.ip ?? "-"}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>
      </Show>
    </main>
  );
}
