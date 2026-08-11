import { createEffect, createSignal, onCleanup } from "solid-js";

export function Countdown(props: { target: Date }) {
  const [now, setNow] = createSignal(Date.now());
  createEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });
  const diff = () => Math.max(0, props.target.getTime() - now());
  const days = () => Math.floor(diff() / 86400000);
  const hours = () => Math.floor((diff() % 86400000) / 3600000);
  const minutes = () => Math.floor((diff() % 3600000) / 60000);
  const seconds = () => Math.floor((diff() % 60000) / 1000);
  return (
    <span>
      {days()}d {hours()}h {minutes()}m {seconds()}s
    </span>
  );
}
