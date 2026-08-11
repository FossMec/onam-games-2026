import { Title } from "@solidjs/meta";
import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { getGame } from "~/server/games/actions";

export default function GamePage() {
  const params = useParams();
  const game = createAsync(() => getGame(params.slug ?? ""));
  return (
    <main>
      <Title>{game()?.title ?? "Game"} — FOSS Onam Games</Title>

      <Show when={!game()}>
        <p>Game not found.</p>
      </Show>

      <Show when={game()}>
        <h1>{game()!.title}</h1>
        <p>
          Day {game()!.day} · {game()!.difficulty}
        </p>

        <Show when={game()!.status === "upcoming"}>
          <p>Hint: {game()!.hint ?? "A mystery awaits…"}</p>
          <p>
            Releases in{" "}
            <Show when={game()!.releaseAt}>
              <Countdown target={new Date(game()!.releaseAt!)} />
            </Show>
          </p>
        </Show>

        <Show when={game()!.status === "tester"}>
          <p>Tester early access is open.</p>
          <Show when={game()!.releaseAt}>
            <p>
              Public release in <Countdown target={new Date(game()!.releaseAt!)} />
            </p>
          </Show>
        </Show>

        <Show when={game()!.status === "live"}>
          <p>The game is live.</p>
          <button type="button" disabled>
            Start game (coming soon)
          </button>
        </Show>

        <Show when={game()!.status === "closed"}>
          <p>This game has ended. Results are on the leaderboard.</p>
        </Show>
      </Show>
    </main>
  );
}
