/**
 * The page that runs a teaching snippet, isolated from this one.
 *
 * Shared by the per-stop playground and the "what's possible" showcase so both
 * get the same guarantees: a sandboxed iframe with an opaque origin, `ctx`/`W`/
 * `H` handed in, and errors posted back rather than thrown into the void.
 */

export const SANDBOX_SIZE = 360;

/**
 * Builds the document for one run.
 *
 * Two details are load-bearing:
 *
 * `<` is escaped inside the string literal, because `JSON.stringify` alone
 * passes `</script>` through and typed text would close the tag and become
 * markup.
 *
 * `run` appears in a comment purely to make the string different every time.
 * Setting `srcdoc` to the value it already holds is a DOM no-op, so pressing
 * Run twice on unchanged code reloaded nothing - which looked like a broken
 * button on the snippet whose whole point is that `Math.random()` gives a new
 * pookalam on every run.
 */
export function sandboxDocument(code: string, run: number, size = SANDBOX_SIZE): string {
  const literal = JSON.stringify(code).replace(/</g, "\\u003c");

  return `<!doctype html>
<!-- run ${run} -->
<html>
  <body style="margin:0;background:#181511">
    <canvas id="pookalam" width="${size}" height="${size}" style="display:block;width:100%;height:auto"></canvas>
    <script>
      const c = document.getElementById("pookalam");
      const ctx = c.getContext("2d");
      const W = ${size}, H = ${size};
      try {
        eval(${literal});
      } catch (e) {
        parent.postMessage(
          { pookalamSandboxError: String((e && e.message) || e).slice(0, 300) },
          "*",
        );
      }
    </script>
  </body>
</html>`;
}
